"use client";

import { ArrowRightIcon, BotIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, Loader2Icon, SearchIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AppLogo } from "@/components/guide/app-logo";
import { LevelMeter, tag } from "@/components/guide/bits";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <section className="enter flex flex-col items-center gap-5 py-10 text-center">
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">How long until your OAuth app is approved?</h1>
        <p className="max-w-lg text-sm text-muted-foreground sm:text-base">
          Name an app and what your agent should do in it. You get the difficulty, the work time, the waiting time, and what blocks approval.
        </p>
        <form
          className="flex w-full max-w-2xl items-center gap-2 rounded-lg border border-input bg-background p-1.5 pl-3 shadow-sm focus-within:ring-1 focus-within:ring-ring"
          onSubmit={(e) => {
            e.preventDefault();
            generate(q);
          }}
        >
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
          <label htmlFor="g-q" className="sr-only">
            Which app, and what should your agent do in it?
          </label>
          <input
            id="g-q"
            ref={input}
            required
            autoComplete="off"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Which app, and what should your agent do in it?"
          />
          <Button type="submit" size="lg" className="px-4" disabled={gen.kind === "running"}>
            Get guide
            <ArrowRightIcon />
          </Button>
        </form>
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
          <span>Try</span>
          {TRY.map(([n, text]) => (
            <Badge
              key={n}
              asChild
              variant="outline"
              className={cn(tag, "cursor-pointer text-foreground hover:bg-accent")}
            >
              <button
                type="button"
                onClick={() => {
                  setQ(text);
                  input.current?.focus();
                }}
              >
                {n}
              </button>
            </Badge>
          ))}
        </div>
        <div className="w-full max-w-2xl text-left">
          <GenStatus state={gen} />
        </div>
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
      <Alert variant="destructive" className="border-destructive/50">
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
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold tracking-tight">{writing ? "Writing the guide" : "Researching the provider's docs"}</span>
        <span className="tnum text-xs text-muted-foreground">
          {searches} searches · {opened} pages opened{writing ? ` · ${chars} characters` : ""}
        </span>
      </div>
      <Progress value={writing ? 90 : Math.min(80, 10 + steps.length * 8)} className="h-1.5" />
      <ol className="flex flex-col gap-2 text-sm">
        {steps.length === 0 && (
          <li className="flex items-center gap-2 text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Finding the developer portal
          </li>
        )}
        {steps.slice(-6).map((x, i, arr) => {
          const last = i === arr.length - 1 && !writing;
          return (
            <li key={`${x.kind}${x.text}${i}`} className={cn("enter flex min-w-0 items-center gap-2", !last && "text-muted-foreground")}>
              {last ? <Loader2Icon className="size-4 shrink-0 animate-spin" /> : <CheckIcon className="pop size-4 shrink-0 text-l1" />}
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
          <li className="flex items-center gap-2">
            <Loader2Icon className="size-4 animate-spin" />
            Writing the guide from what it opened
          </li>
        )}
      </ol>
      <div className="flex flex-col gap-2 pt-1">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
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
    <section className="enter flex flex-col gap-4" style={{ ["--i" as string]: 1 }}>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Apps</h2>
        <p className="text-sm text-muted-foreground">Reviewed guides show their difficulty level. For the rest, the agent writes a live draft.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="lib-q" className="sr-only">
            Filter apps
          </label>
          <Input id="lib-q" autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter apps…" className="h-9 pl-9" />
        </div>
        <div className="overflow-x-auto">
          <Tabs value={String(filter)} onValueChange={(v) => setFilter(Number(v))}>
            <TabsList className="h-9">
              {FILTERS.map(([n, t]) => (
                <TabsTrigger key={n} value={String(n)} className="px-3" title={n >= 1 && n <= 4 ? `Level ${n} · ${LEVELS[n - 1].name}` : undefined}>
                  {t}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <ul className="divide-y">
          {rows.length === 0 && (
            <li className="flex flex-col items-center gap-2 p-10 text-center">
              <span className="font-medium">No apps match</span>
              <span className="text-sm text-muted-foreground">Describe the app in the search box at the top and the agent writes a guide.</span>
            </li>
          )}
          {rows.map((c, idx) => {
            const g = guides[c.key];
            return g ? (
              <ReviewedRow key={c.key} c={c} g={g} logo={logos[c.key]} />
            ) : (
              <UnratedRow key={c.key} c={c} i={idx} logo={logos[c.key]} onGenerate={onGenerate} />
            );
          })}
        </ul>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {showToggle && (
            <Button variant="outline" size="lg" className="px-4" onClick={() => setShowAll((s) => !s)}>
              {collapsed ? `Show all ${catalog.length} apps` : "Show reviewed only"}
              <ChevronDownIcon className={cn("size-3.5", !collapsed && "rotate-180")} />
            </Button>
          )}
          <Button size="lg" className="px-4" onClick={() => setDialogOpen(true)}>
            <BotIcon />
            Start a guide for an app not listed
          </Button>
        </div>
        <p className="tnum text-xs text-muted-foreground">
          {rows.length} of {catalog.length} apps · {Object.keys(guides).length} reviewed
        </p>
      </div>

      <NewAppDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={onNewApp} />
    </section>
  );
}

function ReviewedRow({ c, g, logo }: { c: CatalogEntry; g: Guide; logo?: LogoInfo }) {
  const l = levelOf(g.difficulty);
  return (
    <li>
      <Link
        href={`/guides/${c.key}`}
        className="flex w-full min-w-0 items-start gap-4 p-4 text-left transition-colors hover:bg-accent/50 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset sm:items-center"
      >
        <AppLogo name={c.app} logo={logo} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex shrink-0 flex-col gap-1.5 sm:w-48">
            <span className="flex items-baseline gap-2">
              <span className="font-semibold tracking-tight">{c.app}</span>
              <span className="text-xs text-muted-foreground">{c.cat}</span>
            </span>
            <div className="flex items-center gap-2">
              <div className="w-14 shrink-0">
                <LevelMeter n={l.n} />
              </div>
              <span className={cn("text-xs font-medium", LEVEL_CLASS[l.n].text)}>
                Level {l.n} · {l.name}
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-sm text-muted-foreground">{g.verdict.split(". ")[0]}.</p>
            <div className="tnum flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="size-3.5" />
                Work {g.hands_on.text} · Wait {g.waiting.normal}
              </span>
              <span>Last updated {fmtDate(g.checked ?? "2026-10-20")}</span>
            </div>
          </div>
        </div>
        <ChevronRightIcon className="hidden size-4 self-center text-muted-foreground sm:block" />
      </Link>
    </li>
  );
}

function UnratedRow({ c, i, logo, onGenerate }: { c: CatalogEntry; i: number; logo?: LogoInfo; onGenerate: (app: string) => void }) {
  return (
    <li className="enter flex items-start gap-4 p-4 sm:items-center" style={{ ["--i" as string]: i }}>
      <AppLogo name={c.app} logo={logo} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex shrink-0 flex-col gap-1.5 sm:w-48">
          <span className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight">{c.app}</span>
            <span className="text-xs text-muted-foreground">{c.cat}</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="w-14 shrink-0">
              <LevelMeter n={0} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Not rated yet</span>
          </div>
        </div>
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          No reviewed guide yet. The agent can write a live draft{c.provider !== c.app ? ` (provider: ${c.provider})` : ""}.
        </p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 self-center" onClick={() => onGenerate(c.app)}>
        Generate guide
      </Button>
    </li>
  );
}
