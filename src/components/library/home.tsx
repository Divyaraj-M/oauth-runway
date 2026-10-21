"use client";

import { ArrowRightIcon, BotIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppLogo } from "@/components/guide/app-logo";
import { LevelMeter } from "@/components/guide/bits";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type AgentEvent, generateGuide } from "@/lib/agent-client";
import { refreshLibrary } from "@/app/actions";
import { useMe } from "@/components/auth/me";
import type { DraftSummary } from "@/lib/db";
import { LEVELS, LEVEL_CLASS, fmtDate, levelOf } from "@/lib/levels";
import { looksLikeSecret } from "@/lib/secrets";
import type { CatalogEntry, Guide, LogoInfo } from "@/lib/types";
import { cn, normName } from "@/lib/utils";

import { NewAppDialog } from "./new-app-dialog";

const TRY = [
  ["Calendly", "Calendly: read upcoming meetings and book new ones for my customers"],
  ["Zoom", "Zoom: create meetings and pull transcripts for my customers"],
  ["Linear", "Linear: create and update issues for my customers"],
] as const;

/** 0 = all, 1–4 = level, 5 = not rated */
const FILTERS = [
  [0, "All"],
  [1, "L1"],
  [2, "L2"],
  [3, "L3"],
  [4, "L4"],
  [5, "Not rated"],
] as const;

/** One line of live research activity, straight from the server's web search / fetch events. */
type Step = { kind: "search" | "fetch" | "note"; text: string };
type GenState = { kind: "idle" } | { kind: "running"; steps: Step[]; chars: number } | { kind: "error"; title: string; message: string };

export function Home({
  guides,
  catalog,
  logos,
  community,
  managed,
  toolkitCount,
}: {
  guides: Record<string, Guide>;
  catalog: CatalogEntry[];
  logos: Record<string, LogoInfo>;
  /** Newest generated guide per app, from the database (shared by everyone). */
  community: DraftSummary[];
  /** Catalog key → whether Composio provides the OAuth app (null: the toolkit has no OAuth). */
  managed: Record<string, boolean | null>;
  toolkitCount: number;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [gen, setGen] = useState<GenState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const me = useMe();

  // Next.js keeps this page mounted but hidden (React Activity) after you navigate away, so a generation
  // can finish while you're elsewhere. Track visibility: the cleanup runs when hidden, the setup when shown again.
  const visible = useRef(true);
  useLayoutEffect(() => {
    visible.current = true;
    return () => {
      visible.current = false;
    };
  }, []);

  // Links from the single-file prototype used #gmail etc.; send them to the real route.
  useEffect(() => {
    const k = location.hash.slice(1);
    if (guides[k]) router.replace(`/guides/${k}`);
  }, [guides, router]);

  // Set synchronously, so a second call in the same tick (before state updates) can't start a parallel run.
  const busy = useRef(false);

  async function generate(query: string) {
    if (busy.current) return;
    busy.current = true;
    try {
      await runGenerate(query);
    } finally {
      busy.current = false;
    }
  }

  async function runGenerate(query: string) {
    const text = query.trim();
    if (!text || gen.kind === "running") return;
    if (looksLikeSecret(text))
      return setGen({ kind: "error", title: "Not sent: this looks like a credential", message: "Describe the app and what your agent does. No keys needed." });

    const words = text.toLowerCase().replace(/https?:\/\//g, "").replace(/www\./g, "").split(/[^a-z0-9]+/);
    const hit = Object.keys(guides).find((k) => words.includes(k));
    if (hit) return router.push(`/guides/${hit}`);

    // Ask the server rather than trusting cached state; if signed out, sign in here and carry on with this run.
    const signedIn = (await me.refresh()) ?? null;
    if (!signedIn && !(await me.requireSignIn())) return;

    setGen({ kind: "running", steps: [], chars: 0 });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const onEvent = (e: AgentEvent) =>
      setGen((s) => {
        if (s.kind !== "running") return s;
        if (e.type === "search") return { ...s, steps: [...s.steps, { kind: "search", text: e.query }] };
        if (e.type === "fetch") return { ...s, steps: [...s.steps, { kind: "fetch", text: e.url }] };
        if (e.type === "note") return { ...s, steps: [...s.steps, { kind: "note", text: e.text }] };
        if (e.type === "text") return { ...s, chars: s.chars + e.delta.length };
        return s;
      });
    try {
      const payload = await generateGuide(text, onEvent, ctrl.signal);
      const href = `/g/${payload.id}`;
      // New guide shows up in the shared library and in "Your recent guides".
      me.refresh();
      await refreshLibrary();
      router.refresh();
      // Reset so coming back to this page doesn't show a finished run as still "Writing the guide".
      setGen({ kind: "idle" });
      setQ("");
      if (visible.current) router.push(href);
      else toast(`${payload.guide.app} guide is ready`, { description: "Saved as a draft. Publish it when it looks right.", action: { label: "Open", onClick: () => router.push(href) } });
    } catch (err) {
      if (ctrl.signal.aborted) return setGen({ kind: "idle" });
      setGen({ kind: "error", title: "Couldn't write the guide", message: err instanceof Error ? err.message : "Something went wrong. Try again." });
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
    }
  }

  const runFromElsewhere = (query: string) => {
    setQ(query);
    window.scrollTo(0, 0);
    generate(query);
  };

  const forApp = (app: string) => `${app}: what does it take to get a production OAuth app approved for my customers?`;

  return (
    <>
      <Suspense>
        <GenerateFromLink onRun={(app) => runFromElsewhere(forApp(app))} />
      </Suspense>
      <section className="flex flex-col items-center gap-8 pt-10 pb-16 text-center md:pt-16">
        <div className="enter flex flex-col items-center gap-5">
          <h1 className="max-w-2xl text-3xl leading-tight font-semibold tracking-tight text-balance md:text-5xl">How long until your OAuth app is approved?</h1>
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
            Name an app and what your agent should do in it. You get the difficulty, the work time, the waiting time, and what blocks approval.
          </p>
        </div>


        <div className="enter flex w-full max-w-2xl flex-col items-center gap-3" style={{ ["--i" as string]: 1 }}>
          <form
            className="w-full"
            onSubmit={(e) => {
              e.preventDefault();
              generate(q);
            }}
          >
            <InputGroup className="h-12 bg-background text-left shadow-xs">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                id="g-q"
                ref={input}
                required
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Which app, and what should your agent do in it?"
                aria-label="Which app, and what should your agent do in it?"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" variant="default" size="sm" disabled={gen.kind === "running"}>
                  Get guide
                  <ArrowRightIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span>Try</span>
            {TRY.map(([n, text]) => (
              <Button
                key={n}
                type="button"
                variant="outline"
                size="xs"
                onClick={() => {
                  setQ(text);
                  input.current?.focus();
                }}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>

        <div className="w-full max-w-2xl text-left">
          {gen.kind === "idle" ? <RecentGuides guides={me.guides} /> : <GenStatus state={gen} onCancel={() => abortRef.current?.abort()} />}
        </div>
      </section>

      <Library
        guides={guides}
        catalog={catalog}
        logos={logos}
        community={community}
        managed={managed}
        toolkitCount={toolkitCount}
        onGenerate={(app) => runFromElsewhere(forApp(app))}
        onNewApp={runFromElsewhere}
      />
    </>
  );
}

/** "Generate" on the toolkits page links to /?generate=<app>: start that run here, then drop the param. */
function GenerateFromLink({ onRun }: { onRun: (app: string) => void }) {
  const app = useSearchParams().get("generate");
  const router = useRouter();
  const run = useEffectEvent(onRun);
  // Effects can run twice for one link (dev Strict Mode, Activity re-showing the page); start each link once.
  const started = useRef<string | null>(null);
  useEffect(() => {
    if (!app || started.current === app) return;
    started.current = app;
    router.replace("/", { scroll: false });
    run(app.slice(0, 100));
  }, [app, router]);
  return null;
}

/** Relative time like "3 min ago" for recent drafts. */
function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return fmtDate(iso.slice(0, 10));
}

/** The last guides this browser generated, newest first; shown under the search when nothing is running. */
function RecentGuides({ guides }: { guides: DraftSummary[] }) {
  const recent = guides.slice(0, 4);
  if (!recent.length) return null;
  return (
    <div className="enter flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">Your recent guides</span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {recent.map((d) => {
          const l = levelOf(d.difficulty);
          return (
            <Item key={d.id} asChild variant="outline" size="sm" className="bg-card">
              <Link href={`/g/${d.id}`}>
                <ItemMedia>
                  <AppLogo name={d.app} logo={d.logo ?? undefined} />
                </ItemMedia>
                <ItemContent className="min-w-0 gap-0.5">
                  <ItemTitle className="w-full">
                    <span className="truncate">{d.app}</span>
                    <Badge variant={d.status === "draft" ? "secondary" : "outline"} className="rounded-md px-1.5 text-[10px]">
                      {d.status === "draft" ? "Draft" : d.status === "approved" ? "Approved" : "Pending"}
                    </Badge>
                    <span className={cn("ml-auto shrink-0 text-xs font-medium", LEVEL_CLASS[l.n].text)}>L{l.n}</span>
                  </ItemTitle>
                  <ItemDescription className="truncate text-xs">
                    Work {d.work} · Wait {d.wait} · {ago(d.createdAt)}
                  </ItemDescription>
                </ItemContent>
              </Link>
            </Item>
          );
        })}
      </div>
    </div>
  );
}

function GenStatus({ state, onCancel }: { state: GenState; onCancel: () => void }) {
  if (state.kind === "idle") return null;
  if (state.kind === "error")
    return (
      <Alert variant="destructive" className="enter border-destructive/50">
        <TriangleAlertIcon />
        <AlertTitle>{state.title}</AlertTitle>
        <AlertDescription>{state.message}</AlertDescription>
      </Alert>
    );
  const { steps, chars } = state;
  const searches = steps.filter((x) => x.kind === "search").length;
  const opened = steps.filter((x) => x.kind === "fetch").length;
  const writing = chars > 0;
  return (
    <Card className="enter gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-semibold tracking-tight">{writing ? "Writing the guide" : "Researching the provider's docs"}</span>
        <div className="flex items-center gap-3">
          <span className="tnum font-mono text-xs text-muted-foreground">
            {searches} searches · {opened} pages opened{writing ? ` · ${chars} chars` : ""}
          </span>
          <Button variant="ghost" size="xs" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
      <Progress value={writing ? 90 : Math.min(80, 10 + steps.length * 8)} className="h-1" />
      <ol className="flex flex-col gap-2 text-sm">
        {steps.length === 0 && (
          <li className="flex items-center gap-2 text-muted-foreground">
            <Spinner />
            Finding the developer portal
          </li>
        )}
        {steps.slice(-6).map((x, i, arr) => {
          const last = i === arr.length - 1 && !writing;
          return (
            <li key={`${x.kind}${x.text}${i}`} className={cn("enter flex min-w-0 items-center gap-2", !last && "text-muted-foreground")}>
              {last ? <Spinner className="shrink-0" /> : <CheckIcon className="pop size-4 shrink-0 text-l1" />}
              {x.kind === "note" ? (
                <span className="min-w-0 truncate">{x.text}</span>
              ) : (
                <>
                  <span className="shrink-0">{x.kind === "search" ? "Searched" : "Opened"}</span>
                  <span className="min-w-0 truncate text-muted-foreground">{x.kind === "search" ? `“${x.text}”` : x.text.replace(/^https?:\/\//, "")}</span>
                </>
              )}
            </li>
          );
        })}
        {writing && (
          <li className="enter flex items-center gap-2">
            <Spinner />
            Writing the guide from what it opened
          </li>
        )}
      </ol>
      {/* Placeholder shaped like the guide header the draft will open on. */}
      <div className="flex flex-col gap-2 border-t pt-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </Card>
  );
}

function Library({
  guides,
  catalog,
  logos,
  community,
  managed,
  toolkitCount,
  onGenerate,
  onNewApp,
}: {
  guides: Record<string, Guide>;
  catalog: CatalogEntry[];
  logos: Record<string, LogoInfo>;
  community: DraftSummary[];
  managed: Record<string, boolean | null>;
  toolkitCount: number;
  onGenerate: (app: string) => void;
  onNewApp: (query: string) => void;
}) {
  const [filter, setFilter] = useState(0);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const router = useRouter();
  const drafts = Object.fromEntries(community.map((d) => [d.slug, d]));

  // Catalog apps, plus generated guides for apps the catalog doesn't list (e.g. Clay), at the end.
  const known = new Set(catalog.map((c) => normName(c.app)));
  const entries: CatalogEntry[] = [
    ...catalog,
    ...community.filter((d) => !known.has(d.slug)).map((d) => ({ key: `draft:${d.slug}`, app: d.app, provider: d.app, cat: "Draft" })),
  ];
  // A reviewed guide always wins over a draft for the same app.
  const draftOf = (c: CatalogEntry) => (guides[c.key] ? undefined : drafts[normName(c.app)]);
  const levelFor = (c: CatalogEntry) => {
    const d = guides[c.key]?.difficulty ?? draftOf(c)?.difficulty;
    return d ? levelOf(d).n : 0;
  };
  const draftCount = entries.filter((c) => draftOf(c)).length;

  const ql = query.toLowerCase();
  const matches = entries.filter((c) => {
    if (ql && !`${c.app} ${c.provider} ${c.cat}`.toLowerCase().includes(ql)) return false;
    if (!filter) return true;
    return filter === 5 ? levelFor(c) === 0 : levelFor(c) === filter;
  });
  const collapsed = !showAll && !ql && !filter;
  const rows = collapsed ? matches.filter((c) => guides[c.key] || draftOf(c)) : matches;
  const hidden = matches.length - rows.length;
  const showToggle = collapsed ? hidden > 0 : showAll && !ql && !filter;

  return (
    <section className="enter flex flex-col gap-4" style={{ ["--i" as string]: 2 }}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Apps</h2>
          <p className="text-sm text-muted-foreground">Reviewed guides show their level. Community guides are AI-researched, published by their authors, and approved by a reviewer.</p>
        </div>
        <p className="tnum hidden shrink-0 font-mono text-xs text-muted-foreground sm:block">
          {rows.length}/{entries.length} · {Object.keys(guides).length} reviewed{draftCount ? ` · ${draftCount} draft${draftCount > 1 ? "s" : ""}` : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="h-9 sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter apps…" aria-label="Filter apps" />
        </InputGroup>
        <div className="overflow-x-auto">
          <ToggleGroup type="single" variant="outline" size="sm" value={String(filter)} onValueChange={(v) => setFilter(v ? Number(v) : 0)} aria-label="Filter by level">
            {FILTERS.map(([n, t]) => (
              <ToggleGroupItem key={n} value={String(n)} className="px-3" title={n >= 1 && n <= 4 ? `Level ${n} · ${LEVELS[n - 1].name}` : undefined}>
                {t}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {rows.length === 0 ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchXIcon />
              </EmptyMedia>
              <EmptyTitle>No apps match</EmptyTitle>
              <EmptyDescription>Describe the app in the search box at the top and the agent researches a guide.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-10 px-4">App</TableHead>
                <TableHead className="h-10">Level</TableHead>
                <TableHead className="hidden h-10 sm:table-cell">Your work</TableHead>
                <TableHead className="hidden h-10 sm:table-cell">Wait</TableHead>
                <TableHead className="h-10">Status</TableHead>
                <TableHead className="hidden h-10 md:table-cell">Updated</TableHead>
                <TableHead className="h-10 px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const g = guides[c.key];
                const d = draftOf(c);
                const href = g ? `/guides/${c.key}` : d ? `/g/${d.id}` : null;
                const level = g ? levelOf(g.difficulty) : d ? levelOf(d.difficulty) : null;
                const work = g ? g.hands_on.text : d?.work;
                const wait = g ? g.waiting.normal : d?.wait;
                const date = g ? (g.checked ?? "2026-10-20") : d?.createdAt.slice(0, 10);
                return (
                  <TableRow key={c.key} className={cn(href && "cursor-pointer")} onClick={href ? () => router.push(href) : undefined}>
                    <TableCell className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <AppLogo name={c.app} logo={logos[c.key] ?? d?.logo ?? undefined} />
                        <div className="flex min-w-0 flex-col">
                          {href ? (
                            <Link href={href} className="truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                              {c.app}
                            </Link>
                          ) : (
                            <span className="truncate font-medium">{c.app}</span>
                          )}
                          <span className="truncate text-xs text-muted-foreground">
                            {c.cat}
                            {managed[c.key] === true ? " · Composio app available" : managed[c.key] === false ? " · Own app on Composio" : ""}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {level ? (
                        <div className="flex flex-col gap-1">
                          <span className={cn("text-xs font-medium", LEVEL_CLASS[level.n].text)}>
                            L{level.n} · {level.name}
                          </span>
                          <div className="w-14">
                            <LevelMeter n={level.n} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not rated</span>
                      )}
                    </TableCell>
                    <TableCell className="tnum hidden sm:table-cell">{work ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="tnum hidden whitespace-normal sm:table-cell">{wait ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      {g ? (
                        <Badge variant="secondary" className="rounded-md">
                          Reviewed
                        </Badge>
                      ) : d?.status === "approved" ? (
                        <Badge variant="outline" className="rounded-md border-l1/30 bg-l1/10 text-l1">
                          Approved
                        </Badge>
                      ) : d ? (
                        <Badge variant="outline" className="rounded-md border-l3/30 bg-l3/10 text-l3">
                          Pending approval
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No guide yet</span>
                      )}
                    </TableCell>
                    <TableCell className="tnum hidden text-muted-foreground md:table-cell">{date ? fmtDate(date) : "—"}</TableCell>
                    <TableCell className="px-4 text-right">
                      {href ? (
                        <ChevronRightIcon className="ml-auto size-4 text-muted-foreground" />
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => onGenerate(c.app)}>
                          Generate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showToggle && (
          <Button variant="outline" size="lg" className="px-4" onClick={() => setShowAll((s) => !s)}>
            {collapsed ? `Show all ${entries.length} apps` : "Show guides only"}
            <ChevronDownIcon className={cn("transition-transform duration-200 ease-(--ease-out)", !collapsed && "rotate-180")} />
          </Button>
        )}
        <Button size="lg" className="px-4" onClick={() => setDialogOpen(true)}>
          <BotIcon />
          Start a guide for an app not listed
        </Button>
        <Button size="lg" variant="ghost" className="px-4" asChild>
          <Link href="/toolkits">
            Browse all {toolkitCount.toLocaleString("en-US")} Composio toolkits
            <ArrowRightIcon />
          </Link>
        </Button>
      </div>

      <NewAppDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={onNewApp} />
    </section>
  );
}
