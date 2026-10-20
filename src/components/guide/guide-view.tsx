"use client";

import {
  BotIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  LinkIcon,
  MessageCircleIcon,
  ShieldIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LEVEL_CLASS, WHO_LABEL, levelOf } from "@/lib/levels";
import { chatId } from "@/lib/chats";
import { toMarkdown } from "@/lib/markdown";
import type { GeneratePayload, Guide, LogoInfo, Who } from "@/lib/types";
import { cn } from "@/lib/utils";

import { AppLogo } from "./app-logo";
import { EvidenceBadge, Freshness, LevelBadge, LevelMeter, tag } from "./bits";
import { ChatSheet } from "./chat-sheet";

const WHO_CLASS: Record<Who, string> = {
  agent: "border-transparent bg-primary text-primary-foreground",
  you: "border-transparent bg-secondary text-secondary-foreground",
  provider: "text-foreground",
};

const TABS = [
  ["steps", "Steps"],
  ["case", "Your case"],
  ["blockers", "Blockers"],
  ["roles", "Who does what"],
  ["sources", "Sources"],
] as const;

async function copy(text: string, msg: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    toast("Copy was blocked here. Select the text manually.");
  }
}

export function GuideView({
  guide: g,
  logo,
  onRemove,
}: {
  guide: Guide;
  logo?: LogoInfo;
  /** Research log of a generated guide (searches, opened pages); kept with the draft. */
  research?: GeneratePayload["research"];
  /** Saved drafts only: removes it from the library list. */
  onRemove?: () => void;
}) {
  const l = levelOf(g.difficulty);
  const lc = LEVEL_CLASS[l.n];
  const total = (g.hands_on.days || 0) + (g.waiting.days || 0);
  const workPct = total ? Math.max(1.5, (g.hands_on.days / total) * 100) : 50;

  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const openChat = (text = "") => {
    if (text) setChatDraft(text);
    setChatOpen(true);
  };

  let i = 0;
  // Staggered entrance, capped so the whole page has landed within ~150ms of delay.
  const stagger = () => ({ style: { ["--i" as string]: Math.min(i++, 3) } });

  return (
    <>
      <Breadcrumb {...stagger()} className="enter">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Library</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{g.app}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <header {...stagger()} className="enter flex flex-col gap-3 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <LevelBadge n={l.n} />
          <Badge variant="secondary" className={tag}>
            {g._generated ? "Live draft" : "Reviewed by hand"}
          </Badge>
          <Freshness g={g} />
        </div>
        <div className="flex items-center gap-3">
          <AppLogo name={g.app} logo={logo} />
          <h1 className="text-3xl font-semibold tracking-tight">{g.app} OAuth app</h1>
        </div>
        <p className="max-w-2xl text-muted-foreground">{g.verdict}</p>
      </header>

      <div {...stagger()} className="enter flex flex-col gap-3 pt-6">
        <Alert role="note">
          <ShieldIcon />
          <AlertTitle>No credentials needed here</AlertTitle>
          <AlertDescription>This guide and the agent never need your client secret. If you paste one into the chat, it is blocked before sending.</AlertDescription>
        </Alert>
      </div>

      <div {...stagger()} className="enter grid grid-cols-1 gap-3 pt-6 md:grid-cols-3">
        <Card className="gap-4 p-5">
          <div className="text-sm font-medium text-muted-foreground">Difficulty</div>
          <LevelMeter n={l.n} className="h-2.5" />
          <div className="flex flex-col gap-1">
            <span className={cn("text-2xl font-semibold tracking-tight", lc.text)}>Level {l.n} of 4</span>
            <span className="font-medium">{l.name}</span>
          </div>
          <p className="text-sm text-muted-foreground">{l.desc}</p>
        </Card>

        <Card className="gap-4 p-5 md:col-span-2">
          <div className="text-sm font-medium text-muted-foreground">Work vs waiting · normal case</div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Your work compared with waiting time">
            <div className="h-full bg-primary" style={{ width: `${workPct}%` }} />
            <div className={cn("h-full flex-1", lc.bgSoft)} />
          </div>
          <div className="tnum grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-primary" />
                Your work
              </span>
              <span className="text-lg font-semibold">{g.hands_on.text}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("size-2 rounded-full", lc.bgSoft)} />
                Waiting on {g.provider}
              </span>
              <span className="text-lg font-semibold">{g.waiting.normal}</span>
            </div>
          </div>
          <Table className="tnum">
            <TableHeader>
              <TableRow>
                <TableHead>Waiting</TableHead>
                <TableHead>Best</TableHead>
                <TableHead>Normal</TableHead>
                <TableHead>Worst</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-transparent">
                <TableCell className="text-muted-foreground">Approval</TableCell>
                <TableCell>{g.waiting.best}</TableCell>
                <TableCell className="font-medium">{g.waiting.normal}</TableCell>
                <TableCell>{g.waiting.worst}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </div>

      <Alert role="note" {...stagger()} className={cn("enter mt-3", lc.note)}>
        <ClockIcon className={lc.text} />
        <AlertTitle>Start now</AlertTitle>
        <AlertDescription>{g.start_now}</AlertDescription>
      </Alert>

      <Tabs defaultValue="steps" {...stagger()} className="enter gap-4 pt-8">
        <div className="overflow-x-auto">
          <TabsList className="h-9">
            {TABS.map(([k, n]) => (
              <TabsTrigger key={k} value={k} className="px-3">
                {n}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="steps">
          <Card className="py-0">
            <ol className="divide-y">
              {g.steps.map((s, idx) => (
                <li key={idx} className="flex gap-4 p-4">
                  <span className="tnum grid size-7 shrink-0 place-items-center rounded-full border text-xs font-medium text-muted-foreground">{idx + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{s.title}</span>
                      <Badge variant="outline" className={cn(tag, WHO_CLASS[s.who] ?? WHO_CLASS.you)}>
                        {WHO_LABEL[s.who] ?? "You"}
                      </Badge>
                      <EvidenceBadge ev={s.ev} src={s.src} />
                    </div>
                    <p className="text-sm text-muted-foreground">{s.detail}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    onClick={() => openChat(`I'm on step ${idx + 1}, "${s.title}". What do I need to get right here?`)}
                  >
                    <MessageCircleIcon />
                    <span className="hidden sm:inline">Ask</span>
                  </Button>
                </li>
              ))}
            </ol>
          </Card>
        </TabsContent>

        <TabsContent value="case">
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-10 px-4">If you…</TableHead>
                  <TableHead className="h-10 px-4">Then</TableHead>
                  <TableHead className="h-10 px-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.cases.map((c) => (
                  <TableRow key={c.case}>
                    <TableCell className="p-4 align-top whitespace-normal">{c.case}</TableCell>
                    <TableCell className="p-4 align-top whitespace-normal text-muted-foreground">{c.outcome}</TableCell>
                    <TableCell className="p-4 text-right align-top">
                      <EvidenceBadge ev={c.ev} src={c.src} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="blockers" className="flex flex-col gap-2">
          {g.blockers.map((b) => (
            <Alert key={b.text} role="note">
              <TriangleAlertIcon className="text-l3!" />
              <div className="col-start-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <span>{b.text}</span>
                <EvidenceBadge ev={b.ev} src={b.src} />
              </div>
            </Alert>
          ))}
        </TabsContent>

        <TabsContent value="roles" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card className="gap-3 p-5">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <BotIcon className="size-4" />
              Agent can do
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {g.agent_can.map((x) => (
                <li key={x} className="flex gap-2">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-l1" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="gap-3 p-5">
            <div className="flex items-center gap-2 font-semibold tracking-tight">
              <KeyRoundIcon className="size-4" />
              You must do
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              {g.you_must.map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="grid grid-cols-1 gap-3">
          <Card className="gap-3 p-5">
            <div className="font-semibold tracking-tight">Not confirmed</div>
            <ul className="flex flex-col gap-2 text-sm">
              {g.unverified.length ? (
                g.unverified.map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <EvidenceBadge ev="uncertain" />
                    <span className="min-w-0">{x}</span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">Nothing flagged.</li>
              )}
            </ul>
          </Card>
          <Card className="gap-1 p-2">
            {g.sources.map((s) =>
              s.u ? (
                <a
                  key={s.t}
                  href={s.u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 break-words">{s.t}</span>
                  <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
                </a>
              ) : (
                <div key={s.t} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0">{s.t}</span>
                  <Badge variant="outline" className={cn(tag, LEVEL_CLASS[1].badge)}>
                    First-hand
                  </Badge>
                </div>
              ),
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <div {...stagger()} className="enter flex flex-wrap gap-2 pt-8">
        <Button size="lg" className="px-4" onClick={() => openChat()}>
          <MessageCircleIcon />
          Ask the agent
        </Button>
        <Button size="lg" variant="outline" className="px-4" onClick={() => copy(toMarkdown(g), "Markdown copied")}>
          <CopyIcon />
          Copy as Markdown
        </Button>
        {!g._generated && (
          <Button size="lg" variant="outline" className="px-4" onClick={() => copy(location.href, "Link copied")}>
            <LinkIcon />
            Copy link
          </Button>
        )}
        {onRemove && (
          <Button size="lg" variant="ghost" className="px-4 text-muted-foreground" onClick={onRemove}>
            <Trash2Icon />
            Remove from list
          </Button>
        )}
      </div>

      <Button
        className="fixed z-40 h-11 rounded-full px-5 shadow-lg"
        style={{ bottom: "calc(20px + env(safe-area-inset-bottom, 0px))", right: "max(20px, env(safe-area-inset-right, 0px))" }}
        onClick={() => openChat()}
      >
        <MessageCircleIcon />
        Ask agent
      </Button>

      <ChatSheet key={chatId(g)} guide={g} open={chatOpen} onOpenChange={setChatOpen} draft={chatDraft} setDraft={setChatDraft} />
    </>
  );
}
