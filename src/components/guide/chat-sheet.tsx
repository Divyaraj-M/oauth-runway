"use client";

import { CheckIcon, ChevronDownIcon, CopyIcon, SendIcon, ShieldIcon, TriangleAlertIcon } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { askAgent, type ChatMessage } from "@/lib/agent-client";
import { clearChat, loadChat, type StoredMessage } from "@/lib/chats";
import { looksLikeSecret } from "@/lib/secrets";
import type { Guide } from "@/lib/types";
import { cn, pageUrl } from "@/lib/utils";

type TraceStep = { t: string; done: boolean };
type Msg = Omit<StoredMessage, "trace"> & { trace?: TraceStep[]; pending?: boolean };

const fromStored = (m: StoredMessage): Msg => ({ ...m, trace: m.trace?.map((t) => ({ t, done: true })) });

export function ChatSheet({
  guide: g,
  chatKey: id,
  open,
  onOpenChange,
  draft,
  setDraft,
  sendRef,
}: {
  guide: Guide;
  /** Names the conversation saved for this user. */
  chatKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Message box text; owned by the parent so a step's "Ask" button can prefill it. */
  draft: string;
  setDraft: (text: string) => void;
  /** Lets the guide page send a message straight away (the "Do it" buttons). */
  sendRef?: React.RefObject<((text: string) => void) | null>;
}) {
  const [hist, setHist] = useState<Msg[]>([]);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Earlier questions for this guide load from the database the first time the panel opens.
  const loaded = useRef(false);
  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    // Earlier turns go first, even if a "Do it" message was already sent while they loaded.
    loadChat(id).then((rows) => {
      if (rows.length) setHist((h) => [...rows.map(fromStored), ...h]);
    });
  }, [open, id]);

  // Keep the newest message in view; ScrollArea scrolls its inner viewport, not the root.
  useEffect(() => {
    if (!open) return;
    const vp = box.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]");
    vp?.scrollTo({ top: vp.scrollHeight });
  }, [hist, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    if (looksLikeSecret(q)) return setBlocked(true);
    setBlocked(false);
    setDraft("");
    setBusy(true);

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
    const at = new Date().toISOString();
    setHist((h) => [...h, { role: "user", content: q, at }, { role: "assistant", content: "", trace: [], pending: true, at }]);

    try {
      await askAgent(g, id, sendable, (e) => {
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

  // Expose send() to the page; assigned after render so it always sees the latest history.
  useEffect(() => {
    if (sendRef) sendRef.current = send;
  });

  const noWait = /^(no wait|0( days?)?)$/i.test(g.waiting.normal.trim());
  const ideas = [
    g.blockers[0] ? "Which blocker is most likely to hit me?" : "What usually blocks approval?",
    noWait ? "What should I test before my first customer connects?" : "What can I do this week to shorten the wait?",
    "Draft the scope list I should request",
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="gap-1 border-b px-5 py-4 pr-12">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-base">Ask about {g.app}</SheetTitle>
            {hist.length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                disabled={busy}
                onClick={() => {
                  setHist([]);
                  clearChat(id);
                }}
              >
                Clear
              </Button>
            )}
          </div>
          <SheetDescription className="text-xs">Answers from this guide, researches what it doesn&apos;t cover. Saved to your account.</SheetDescription>
        </SheetHeader>

        <ScrollArea ref={box} className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 px-5 py-5">
            {hist.length === 0 ? (
              <p className="enter text-sm leading-relaxed text-muted-foreground">
                Ask about any step, scope or blocker. The agent can also write things for you: a plan doc, a scope list, a reviewer email.
              </p>
            ) : (
              hist.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="enter flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2 text-sm whitespace-pre-wrap">{m.content}</div>
                  </div>
                ) : (
                  <div key={i} className="enter flex flex-col gap-2">
                    {m.pending && !m.content ? (
                      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner className="size-3.5" />
                        {m.trace?.at(-1)?.t ?? "Thinking…"}
                      </span>
                    ) : (
                      <div className={cn("text-sm leading-relaxed", m.error && "text-destructive")}>
                        <ChatMarkdown text={m.content} />
                      </div>
                    )}
                    {!!m.trace?.length && !(m.pending && !m.content) && <Trace steps={m.trace} pending={!!m.pending} />}
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
          {hist.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {ideas.map((q) => (
                <Button key={q} type="button" variant="outline" size="xs" className="rounded-full" onClick={() => send(q)}>
                  {q}
                </Button>
              ))}
            </div>
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
              placeholder={`Ask about ${g.app}…`}
              aria-label="Message the agent"
              className="min-h-[52px]"
            />
            <InputGroupAddon align="block-end" className="justify-between">
              <InputGroupText className="text-xs">
                <ShieldIcon className="size-3" />
                Key-like text is blocked
              </InputGroupText>
              <InputGroupButton type="submit" variant="default" size="icon-sm" disabled={busy || !draft.trim()} aria-label="Send">
                {busy ? <Spinner /> : <SendIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/** Agent answers are Markdown: lists, bold, inline code, and code blocks with a Copy button (e.g. scope lists). */
function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc [&_strong]:font-semibold [&_strong]:text-foreground">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href ? pageUrl(href) : undefined} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2 hover:text-foreground">
              {children}
            </a>
          ),
          code: ({ className, children }) =>
            /language-|\n/.test(`${className ?? ""}${String(children)}`) ? (
              <code className="font-mono text-xs">{children}</code>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
            ),
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLPreElement>(null);
  return (
    <div className="relative">
      <pre ref={ref} className="overflow-x-auto rounded-md border bg-muted/50 p-3 pr-16 whitespace-pre">
        {children}
      </pre>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="absolute top-2 right-2"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(ref.current?.innerText ?? "");
            toast("Copied");
          } catch {
            toast("Copy was blocked here. Select the text instead.");
          }
        }}
      >
        <CopyIcon />
        Copy
      </Button>
    </div>
  );
}

function Trace({ steps, pending }: { steps: TraceStep[]; pending: boolean }) {
  const [userOpen, setUserOpen] = useState(false);
  const opened = steps.filter((s) => s.t.startsWith("Opened")).length;
  return (
    <Collapsible open={pending || userOpen} onOpenChange={setUserOpen} className="text-xs">
      <CollapsibleTrigger className="group inline-flex items-center gap-1.5 text-muted-foreground transition-colors duration-150 hover:text-foreground">
        {pending ? <Spinner className="size-3" /> : <CheckIcon className="size-3 text-l1" />}
        {pending ? "Researching" : opened ? `Read ${opened} page${opened > 1 ? "s" : ""}` : "Answered from the guide"}
        <ChevronDownIcon className="size-3 transition-transform duration-200 ease-(--ease-out) group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <ol className="mt-2 flex flex-col gap-1 border-l pl-3">
          {steps.map((s) => (
            <li key={s.t} className={cn("break-words", s.done ? "text-muted-foreground" : "text-foreground")}>
              {s.t}
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
