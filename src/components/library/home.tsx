"use client";

import { ArrowRightIcon, BotIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, SearchIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppLogo } from "@/components/guide/app-logo";
import { LevelMeter } from "@/components/guide/bits";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type AgentEvent, generateGuide, saveDraft } from "@/lib/agent-client";
import { LEVELS, LEVEL_CLASS, fmtDate, levelOf } from "@/lib/levels";
import { looksLikeSecret } from "@/lib/secrets";
import type { CatalogEntry, Guide, LogoInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

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

export function Home({ guides, catalog, logos }: { guides: Record<string, Guide>; catalog: CatalogEntry[]; logos: Record<string, LogoInfo> }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [gen, setGen] = useState<GenState>({ kind: "idle" });

  // Links from the single-file prototype used #gmail etc.; send them to the real route.
  useEffect(() => {
    const k = location.hash.slice(1);
    if (guides[k]) router.replace(`/guides/${k}`);
  }, [guides, router]);

  async function generate(query: string) {
    const text = query.trim();
    if (!text || gen.kind === "running") return;
    if (looksLikeSecret(text))
      return setGen({ kind: "error", title: "Not sent: this looks like a credential", message: "Describe the app and what your agent does. No keys needed." });

    const words = text.toLowerCase().replace(/https?:\/\//g, "").replace(/www\./g, "").split(/[^a-z0-9]+/);
    const hit = Object.keys(guides).find((k) => words.includes(k));
    if (hit) return router.push(`/guides/${hit}`);

    setGen({ kind: "running", steps: [], chars: 0 });
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
      const payload = await generateGuide(text, onEvent);
      saveDraft(payload);
      router.push("/draft");
    } catch (err) {
      setGen({ kind: "error", title: "Couldn't write the guide", message: err instanceof Error ? err.message : "Something went wrong. Try again." });
    }
  }

  const runFromElsewhere = (query: string) => {
    setQ(query);
    window.scrollTo(0, 0);
    generate(query);
  };

  return (
    <>
      <section className="flex flex-col items-center gap-8 pt-10 pb-16 text-center md:pt-16">
        <div className="enter flex flex-col items-center gap-5">
          <h1 className="max-w-3xl text-5xl leading-[1.02] font-semibold tracking-tighter text-balance md:text-7xl">How long until your OAuth app is approved?</h1>
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

        {gen.kind !== "idle" && (
          <div className="w-full max-w-2xl text-left">
            <GenStatus state={gen} />
          </div>
        )}
      </section>

      <Library
        guides={guides}
        catalog={catalog}
        logos={logos}
        onGenerate={(app) => runFromElsewhere(`${app}: what does it take to get a production OAuth app approved for my customers?`)}
        onNewApp={runFromElsewhere}
      />
    </>
  );
}

function GenStatus({ state }: { state: GenState }) {
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
        <span className="tnum font-mono text-xs text-muted-foreground">
          {searches} searches · {opened} pages opened{writing ? ` · ${chars} chars` : ""}
        </span>
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
  onGenerate,
  onNewApp,
}: {
  guides: Record<string, Guide>;
  catalog: CatalogEntry[];
  logos: Record<string, LogoInfo>;
  onGenerate: (app: string) => void;
  onNewApp: (query: string) => void;
}) {
  const [filter, setFilter] = useState(0);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const ql = query.toLowerCase();
  const matches = catalog.filter((c) => {
    const g = guides[c.key];
    if (ql && !`${c.app} ${c.provider} ${c.cat}`.toLowerCase().includes(ql)) return false;
    if (!filter) return true;
    if (filter === 5) return !g;
    return !!g && levelOf(g.difficulty).n === filter;
  });
  const collapsed = !showAll && !ql && !filter;
  const rows = collapsed ? matches.filter((c) => guides[c.key]) : matches;
  const hidden = matches.length - rows.length;
  const showToggle = collapsed ? hidden > 0 : showAll && !ql && !filter;

  return (
    <section className="enter flex flex-col gap-4" style={{ ["--i" as string]: 2 }}>
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Apps</h2>
          <p className="text-sm text-muted-foreground">Reviewed guides show their level. For the rest, the agent researches a live draft.</p>
        </div>
        <p className="tnum hidden shrink-0 font-mono text-xs text-muted-foreground sm:block">
          {rows.length}/{catalog.length} · {Object.keys(guides).length} reviewed
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

      <div className="overflow-hidden rounded-xl border bg-card" role="list">
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
          <div className="divide-y">
            {rows.map((c, idx) => {
              const g = guides[c.key];
              return g ? (
                <ReviewedRow key={c.key} c={c} g={g} logo={logos[c.key]} />
              ) : (
                <UnratedRow key={c.key} c={c} i={showAll ? idx : -1} logo={logos[c.key]} onGenerate={onGenerate} />
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showToggle && (
          <Button variant="outline" size="lg" className="px-4" onClick={() => setShowAll((s) => !s)}>
            {collapsed ? `Show all ${catalog.length} apps` : "Show reviewed only"}
            <ChevronDownIcon className={cn("transition-transform duration-200 ease-(--ease-out)", !collapsed && "rotate-180")} />
          </Button>
        )}
        <Button size="lg" className="px-4" onClick={() => setDialogOpen(true)}>
          <BotIcon />
          Start a guide for an app not listed
        </Button>
      </div>

      <NewAppDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={onNewApp} />
    </section>
  );
}

function ReviewedRow({ c, g, logo }: { c: CatalogEntry; g: Guide; logo?: LogoInfo }) {
  const l = levelOf(g.difficulty);
  return (
    <Item asChild className="rounded-none px-4 py-4" role="listitem">
      <Link href={`/guides/${c.key}`}>
        <ItemMedia>
          <AppLogo name={c.app} logo={logo} />
        </ItemMedia>
        <ItemContent className="min-w-0 gap-2 sm:flex-row sm:items-center sm:gap-6">
          <div className="flex shrink-0 flex-col gap-1.5 sm:w-48">
            <ItemTitle>
              {c.app}
              <span className="text-xs font-normal text-muted-foreground">{c.cat}</span>
            </ItemTitle>
            <div className="flex items-center gap-2">
              <div className="w-14 shrink-0">
                <LevelMeter n={l.n} />
              </div>
              <span className={cn("text-xs font-medium", LEVEL_CLASS[l.n].text)}>
                L{l.n} · {l.name}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <ItemDescription className="line-clamp-1">{g.verdict.split(". ")[0]}.</ItemDescription>
            <div className="tnum flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="size-3.5" />
                Work {g.hands_on.text} · Wait {g.waiting.normal}
              </span>
              <span>Updated {fmtDate(g.checked ?? "2026-10-20")}</span>
            </div>
          </div>
        </ItemContent>
        <ItemActions className="hidden sm:flex">
          <ChevronRightIcon className="size-4 text-muted-foreground transition-transform duration-150 ease-(--ease-out) group-hover/item:translate-x-0.5" />
        </ItemActions>
      </Link>
    </Item>
  );
}

/** `i` ≥ 0 staggers the row in when "Show all" reveals it; filtering (frequent) never animates. */
function UnratedRow({ c, i, logo, onGenerate }: { c: CatalogEntry; i: number; logo?: LogoInfo; onGenerate: (app: string) => void }) {
  return (
    <Item className={cn("rounded-none px-4 py-4", i >= 0 && "enter")} style={i >= 0 ? { ["--i" as string]: Math.min(i, 8) } : undefined} role="listitem">
      <ItemMedia>
        <AppLogo name={c.app} logo={logo} />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-2 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex shrink-0 flex-col gap-1.5 sm:w-48">
          <ItemTitle>
            {c.app}
            <span className="text-xs font-normal text-muted-foreground">{c.cat}</span>
          </ItemTitle>
          <div className="flex items-center gap-2">
            <div className="w-14 shrink-0">
              <LevelMeter n={0} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Not rated yet</span>
          </div>
        </div>
        <ItemDescription className="min-w-0 flex-1">
          No reviewed guide yet. The agent can research a live draft{c.provider !== c.app ? ` (provider: ${c.provider})` : ""}.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" size="sm" onClick={() => onGenerate(c.app)}>
          Generate guide
        </Button>
      </ItemActions>
    </Item>
  );
}
