"use client";

import { CheckIcon, EyeIcon, EyeOffIcon, SettingsIcon, ShieldIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useMe } from "@/components/auth/me";
import { GEMINI_MODELS, type Provider, type SettingsInput, removeKey, saveSettings, testKey } from "@/lib/ai-settings";
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
type Form = { provider: Provider; apiKey: string; model: string; search: boolean };

/** Header button + dialog where each user enters their own AI key. Other components open it via the "open-ai-settings" event. */
export function AiSettingsButton() {
  const { user, ai, requireSignIn } = useMe();
  const hasKey = !!ai;
  const [open, setOpen] = useState(false);
  // Keys are saved on the account, so sign in first.
  const openSettings = async () => {
    if (user || (await requireSignIn())) setOpen(true);
  };

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("open-ai-settings", onOpen);
    return () => window.removeEventListener("open-ai-settings", onOpen);
  }, []);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={openSettings} aria-label="AI settings">
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
  const { ai, refresh } = useMe();
  // The saved key never comes back to the browser; leaving the field empty keeps it.
  const [s, setS] = useState<Form>({ provider: ai?.provider ?? "gemini", apiKey: "", model: ai?.model ?? GEMINI_MODELS[0].id, search: ai?.search ?? false });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [check, setCheck] = useState<Check>({ kind: "idle" });
  const p = PROVIDERS[s.provider];
  const keepsSaved = !!ai && ai.provider === s.provider && !s.apiKey.trim();
  const input = (): SettingsInput => ({ ...s, apiKey: s.apiKey.trim() || undefined });
  const set = (patch: Partial<Form>) => {
    setS((x) => ({ ...x, ...patch }));
    setCheck({ kind: "idle" });
  };

  async function test() {
    if (!s.apiKey.trim() && !keepsSaved) return setCheck({ kind: "error", message: "Paste a key first." });
    setCheck({ kind: "checking" });
    const r = await testKey(input());
    setCheck(r.ok ? { kind: "ok" } : { kind: "error", message: r.message ?? "The key didn't work." });
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
          onSubmit={async (e) => {
            e.preventDefault();
            if (!s.apiKey.trim() && !keepsSaved) return setCheck({ kind: "error", message: "Paste a key first." });
            setSaving(true);
            try {
              await saveSettings(input());
              await refresh();
              toast(s.apiKey.trim() ? "AI key saved to your account (encrypted)" : "Settings saved");
              onClose();
            } catch (err) {
              setCheck({ kind: "error", message: err instanceof Error ? err.message : "Couldn't save." });
            } finally {
              setSaving(false);
            }
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ai-provider">Provider</FieldLabel>
              <Select value={s.provider} onValueChange={(v) => set({ provider: v as Provider })}>
                <SelectTrigger id="ai-provider" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini">Google Gemini (free tier)</SelectItem>
                  <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>{p.model}</FieldDescription>
            </Field>

            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="ai-key">{p.label} API key</FieldLabel>
                <a
                  href={p.getKey}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Get a key
                </a>
              </div>
              <InputGroup className="h-9">
                <InputGroupInput
                  id="ai-key"
                  type={show ? "text" : "password"}
                  autoComplete="off"
                  spellCheck={false}
                  value={s.apiKey}
                  onChange={(e) => set({ apiKey: e.target.value })}
                  placeholder={keepsSaved ? `Saved key ending in ••••${ai.last4}` : p.keyHint}
                  className="font-mono"
                  aria-invalid={check.kind === "error" || undefined}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" onClick={() => setShow((x) => !x)} aria-label={show ? "Hide key" : "Show key"}>
                    {show ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {keepsSaved && <FieldDescription>Leave empty to keep the saved key, or paste a new one to replace it.</FieldDescription>}
            </Field>

            {s.provider === "gemini" && (
              <>
                <Field>
                  <FieldLabel htmlFor="ai-model">Model</FieldLabel>
                  <Select value={s.model} onValueChange={(v) => set({ model: v })}>
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
                </Field>
                <Field orientation="horizontal">
                  <Checkbox id="ai-search" checked={s.search} onCheckedChange={(v) => set({ search: v === true })} />
                  <FieldContent>
                    <FieldLabel htmlFor="ai-search">Use Google Search</FieldLabel>
                    <FieldDescription>Paid Gemini tier only. Off: the agent picks official pages and reads them.</FieldDescription>
                  </FieldContent>
                </Field>
              </>
            )}
          </FieldGroup>

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
            Saved to your account, encrypted (AES-256). It never comes back to the browser and isn&apos;t logged; signing out leaves nothing here. Use a key you can revoke.
          </p>

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              className="px-3 text-muted-foreground"
              disabled={!ai}
              onClick={async () => {
                await removeKey().catch(() => null);
                await refresh();
                toast("AI key removed from your account");
                onClose();
              }}
            >
              Remove key
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" size="lg" className="px-4" onClick={test} disabled={check.kind === "checking"}>
                {check.kind === "checking" && <Spinner />}
                Test key
              </Button>
              <Button type="submit" size="lg" className="px-4" disabled={saving}>
                {saving && <Spinner />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
