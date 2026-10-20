"use client";

import { CheckIcon, EyeIcon, EyeOffIcon, Loader2Icon, SettingsIcon, ShieldIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type AiSettings, GEMINI_MODELS, type Provider, aiHeaders, clearSettings, loadSettings, saveSettings, useHasKey } from "@/lib/ai-settings";
import { cn } from "@/lib/utils";

const PROVIDERS: Record<Provider, { label: string; keyHint: string; getKey: string; model: string }> = {
  gemini: {
    label: "Google Gemini",
    keyHint: "AIza…",
    getKey: "https://aistudio.google.com/apikey",
    model: "Free tier works. Without billing, it reads the provider's pages but can't use Google Search.",
  },
  anthropic: {
    label: "Anthropic Claude",
    keyHint: "sk-ant-…",
    getKey: "https://console.anthropic.com/settings/keys",
    model: "Claude Opus 5.5 with web search and web fetch. Needs API credits.",
  },
};

type Check = { kind: "idle" } | { kind: "checking" } | { kind: "ok" } | { kind: "error"; message: string };

/** Header button + dialog where each user enters their own AI key. Other components open it via the "open-ai-settings" event. */
export function AiSettingsButton() {
  const hasKey = useHasKey();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-ai-settings", onOpen);
    return () => window.removeEventListener("open-ai-settings", onOpen);
  }, []);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)} aria-label="AI settings">
        <span className={cn("size-1.5 rounded-full", hasKey ? "bg-l1" : "bg-l3")} aria-hidden />
        <SettingsIcon />
        <span className="hidden sm:inline">{hasKey ? "AI key set" : "Add AI key"}</span>
      </Button>
      {/* Mounted only while open, so the form starts from the saved settings each time. */}
      {open && <SettingsDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<AiSettings>(loadSettings);
  const [show, setShow] = useState(false);
  const [check, setCheck] = useState<Check>({ kind: "idle" });
  const p = PROVIDERS[s.provider];
  const set = (patch: Partial<AiSettings>) => {
    setS((x) => ({ ...x, ...patch }));
    setCheck({ kind: "idle" });
  };

  async function test() {
    if (!s.apiKey.trim()) return setCheck({ kind: "error", message: "Paste a key first." });
    setCheck({ kind: "checking" });
    try {
      const res = await fetch("/api/key-check", { method: "POST", headers: aiHeaders({ ...s, apiKey: s.apiKey.trim() }) });
      const data = await res.json().catch(() => ({}));
      setCheck(res.ok && data.ok ? { kind: "ok" } : { kind: "error", message: data.message || "The key didn't work." });
    } catch {
      setCheck({ kind: "error", message: "Couldn't reach the server." });
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>AI provider</DialogTitle>
          <DialogDescription>Bring your own key. The agent uses it to research guides and answer questions.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveSettings({ ...s, apiKey: s.apiKey.trim() });
            toast(s.apiKey.trim() ? "AI key saved in this browser" : "Settings saved");
            onClose();
          }}
        >
          <div className="grid gap-2">
            <label htmlFor="ai-provider" className="text-sm leading-none font-medium">
              Provider
            </label>
            <Select value={s.provider} onValueChange={(v) => set({ provider: v as Provider })}>
              <SelectTrigger id="ai-provider" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gemini">Google Gemini (free tier)</SelectItem>
                <SelectItem value="anthropic">Anthropic Claude</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{p.model}</p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="ai-key" className="text-sm leading-none font-medium">
                {p.label} API key
              </label>
              <a href={p.getKey} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                Get a key
              </a>
            </div>
            <div className="flex gap-2">
              <Input
                id="ai-key"
                type={show ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                value={s.apiKey}
                onChange={(e) => set({ apiKey: e.target.value })}
                placeholder={p.keyHint}
                className="h-9 font-mono"
              />
              <Button type="button" variant="outline" size="icon-lg" onClick={() => setShow((x) => !x)} aria-label={show ? "Hide key" : "Show key"}>
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </Button>
            </div>
          </div>

          {s.provider === "gemini" && (
            <>
              <div className="grid gap-2">
                <label htmlFor="ai-model" className="text-sm leading-none font-medium">
                  Model
                </label>
                <Select value={s.geminiModel} onValueChange={(v) => set({ geminiModel: v })}>
                  <SelectTrigger id="ai-model" className="h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GEMINI_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-current" checked={s.geminiSearch} onChange={(e) => set({ geminiSearch: e.target.checked })} />
                <span>
                  Use Google Search
                  <span className="block text-xs text-muted-foreground">Paid Gemini tier only. Off: the agent picks official pages and reads them.</span>
                </span>
              </label>
            </>
          )}

          {check.kind === "ok" && (
            <Alert className="border-l1/40 text-l1">
              <CheckIcon />
              <AlertTitle>Key works</AlertTitle>
              <AlertDescription className="text-l1/90">
                {s.provider === "anthropic" ? "Accepted by Anthropic. Research also needs API credits on the account." : "Accepted by Google."}
              </AlertDescription>
            </Alert>
          )}
          {check.kind === "error" && (
            <Alert variant="destructive" className="border-destructive/50">
              <TriangleAlertIcon />
              <AlertTitle>Key check failed</AlertTitle>
              <AlertDescription>{check.message}</AlertDescription>
            </Alert>
          )}

          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldIcon className="mt-0.5 size-3 shrink-0" />
            Stored only in this browser. Sent with each agent request to call the provider, never saved or logged on the server. Use a key you can revoke.
          </p>

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="px-3 text-muted-foreground"
              onClick={() => {
                clearSettings();
                toast("AI key removed from this browser");
                onClose();
              }}
            >
              Remove key
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" size="lg" className="px-4" onClick={test} disabled={check.kind === "checking"}>
                {check.kind === "checking" && <Loader2Icon className="animate-spin" />}
                Test key
              </Button>
              <Button type="submit" size="lg" className="px-4">
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
