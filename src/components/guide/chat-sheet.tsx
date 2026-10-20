"use client";

import { BotIcon, CheckIcon, ChevronDownIcon, SendIcon, ShieldIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { askAgent, type ChatMessage } from "@/lib/agent-client";
import { looksLikeSecret } from "@/lib/secrets";
import type { Guide } from "@/lib/types";
import { cn } from "@/lib/utils";

type TraceStep = { t: string; done: boolean };
type Msg = ChatMessage & { trace?: TraceStep[]; pending?: boolean; error?: boolean };

export function ChatSheet({
  guide: g,
  open,
  onOpenChange,
  draft,
  setDraft,
}: {
  guide: Guide;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Message box text; owned by the parent so a step's "Ask" button can prefill it. */
  draft: string;
  setDraft: (text: string) => void;
}) {
  const [hist, setHist] = useState<Msg[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Keep the newest message in view; ScrollArea scrolls its inner viewport, not the root.
  useEffect(() => {
    const vp = box.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
    vp?.scrollTo({ top: vp.scrollHeight });
  }, [hist]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    if (looksLikeSecret(q)) return setBlocked(true);
    setBlocked(false);
    setDraft("");
    setBusy(true);

    const trace: TraceStep[] = [{ t: `Read the ${g.app} guide: ${g.steps.length} steps, ${g.blockers.length} blockers`, done: true }];
    // Messages sent to the model: drop failed turns and the user message that caused them.
    const sendable: ChatMessage[] = [];
    for (const m of hist) {
      if (m.error) {
        if (sendable.at(-1)?.role === "user") sendable.pop();
        continue;
      }
      sendable.push({ role: m.role, content: m.content });
    }
    sendable.push({ role: "user", content: q });

    // The reply is always the last message; patch it as events stream in.
    const update = (patch: (m: Msg) => Partial<Msg>) => setHist((h) => [...h.slice(0, -1), { ...h[h.length - 1], ...patch(h[h.length - 1]) }]);
    // Each real search or page fetch becomes a trace step; earlier steps are marked done as new ones arrive.
    const addStep = (t: string) => update((m) => ({ trace: [...(m.trace ?? []).map((x) => ({ ...x, done: true })), { t, done: false }] }));
    setHist((h) => [...h, { role: "user", content: q }, { role: "assistant", content: "", trace, pending: true }]);

    try {
      await askAgent(g, sendable, (e) => {
        if (e.type === "search") addStep(`Searched “${e.query}”`);
        if (e.type === "fetch") addStep(`Opened ${e.url.replace(/^https?:\/\//, "")}`);
        if (e.type === "note") addStep(e.text);
        if (e.type === "text") update((m) => ({ content: m.content + e.delta }));
      });
    } catch (err) {
      update(() => ({ error: true, content: err instanceof Error ? err.message : "Something went wrong. Ask again." }));
    } finally {
      update((m) => ({ pending: false, trace: (m.trace ?? []).map((x) => ({ ...x, done: true })) }));
      setBusy(false);
    }
  }

  const ideas = [
    g.blockers[0] ? "Which blocker is most likely to hit me?" : "What usually blocks approval?",
    "What can I do this week to shorten the wait?",
    "What if this is only for my own company?",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b p-5">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <BotIcon className="size-4" />
            Integration agent
          </SheetTitle>
          <SheetDescription>
            Ask about {g.app} while you set it up. It reads this guide, researches what the guide doesn&apos;t cover, and says when it isn&apos;t sure.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea ref={box} className="min-h-0 flex-1">
          <div className="flex flex-col gap-5 p-5">
            {hist.length === 0 ? (
              <Empty className="enter border-0 p-0 pt-10">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <BotIcon />
                  </EmptyMedia>
                  <EmptyTitle>Stuck on {g.app}?</EmptyTitle>
                  <EmptyDescription>Ask about any step. The agent knows this guide and can draft plan docs, scope lists and emails.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent className="w-full max-w-xs">
                  {ideas.map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      className="h-auto w-full justify-start py-2 text-left whitespace-normal"
                      onClick={() => send(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </EmptyContent>
              </Empty>
            ) : (
              hist.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="enter flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm whitespace-pre-wrap text-primary-foreground">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="enter flex gap-3">
                    <Avatar className="size-7">
                      <AvatarFallback>
                        <BotIcon className="size-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {m.trace && <Trace steps={m.trace} pending={!!m.pending} />}
                      <div className={cn("text-sm whitespace-pre-wrap", m.error && "text-destructive")}>
                        {m.content ||
                          (m.pending && (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <Spinner className="size-3.5" />
                              Thinking…
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </ScrollArea>

        <form
          className="flex flex-col gap-2 border-t p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          {blocked && (
            <Alert variant="destructive" className="enter border-destructive/50">
              <TriangleAlertIcon />
              <AlertTitle>Not sent: this looks like a credential</AlertTitle>
              <AlertDescription className="text-xs">Remove the key or secret and ask again. The agent never needs it.</AlertDescription>
            </Alert>
          )}
          <InputGroup>
            <InputGroupTextarea
              id="chat-q"
              rows={2}
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask about a step, a scope, a blocker…"
              aria-label="Message the agent"
              className="min-h-[60px]"
            />
            <InputGroupAddon align="block-end" className="justify-between">
              <InputGroupText className="text-xs">
                <ShieldIcon className="size-3" />
                Key-like text is blocked
              </InputGroupText>
              <InputGroupButton type="submit" variant="default" size="icon-sm" disabled={busy} aria-label="Send">
                {busy ? <Spinner /> : <SendIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Trace({ steps, pending }: { steps: TraceStep[]; pending: boolean }) {
  // Open while research runs; afterwards it collapses unless the reader opens it.
  const [userOpen, setUserOpen] = useState(false);
  return (
    <Collapsible open={pending || userOpen} onOpenChange={setUserOpen} className="rounded-md border text-xs">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-3 py-2 text-muted-foreground transition-colors duration-150 hover:text-foreground">
        {pending ? <Spinner className="size-3.5" /> : <CheckIcon className="size-3.5 text-l1" />}
        <span className="flex-1 text-left">{pending ? "Researching" : `Researched · ${steps.length} steps`}</span>
        <ChevronDownIcon className="size-3.5 transition-transform duration-200 ease-(--ease-out) group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <ol className="flex flex-col gap-1.5 border-t px-3 py-2">
          {steps.map((s) => (
            <li key={s.t} className={cn("flex items-start gap-2", s.done ? "text-foreground" : "text-muted-foreground")}>
              {s.done ? <CheckIcon className="mt-px size-3.5 shrink-0 text-l1" /> : <Spinner className="mt-px size-3.5 shrink-0" />}
              <span className="min-w-0 break-words">{s.t}</span>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
