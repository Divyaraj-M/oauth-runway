"use client";

import { ArrowLeftIcon, MailIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

const CODE_LENGTH = 6;
const RESEND_AFTER_S = 30;

type Step = { kind: "email" } | { kind: "code"; email: string; sentAt: number };

/**
 * Passwordless sign-in: email → 6-digit code (Neon Auth email OTP). The same flow creates the account the first
 * time, so there is no separate sign-up, password, or "forgot password".
 */
export function SignInDialog({ open, onOpenChange, onSignedIn }: { open: boolean; onOpenChange: (o: boolean) => void; onSignedIn: () => void }) {
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Set when a code is sent (not at render: the dialog is prerendered with the page).
  const [now, setNow] = useState(0);

  // Ticks the resend countdown while the code step is showing.
  useEffect(() => {
    if (step.kind !== "code") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step.kind]);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setStep({ kind: "email" });
      setCode("");
      setError("");
    }
  };

  /** The SDK sometimes returns { error } and sometimes throws; treat both the same. */
  const attempt = async <T,>(call: () => Promise<{ error?: { message?: string } | null } & T>, fallback: string) => {
    setBusy(true);
    setError("");
    try {
      const res = await call();
      if (res.error) {
        setError(friendly(res.error.message) ?? fallback);
        return false;
      }
      return true;
    } catch (e) {
      setError(friendly(e instanceof Error ? e.message : undefined) ?? fallback);
      return false;
    } finally {
      setBusy(false);
    }
  };

  async function send(to: string) {
    const ok = await attempt(() => authClient.emailOtp.sendVerificationOtp({ email: to, type: "sign-in" }), "Couldn't send the code. Check the address and try again.");
    if (!ok) return;
    setCode("");
    setStep({ kind: "code", email: to, sentAt: Date.now() });
    setNow(Date.now());
  }

  async function verify(otp: string) {
    if (step.kind !== "code" || otp.length !== CODE_LENGTH) return;
    const ok = await attempt(() => authClient.signIn.emailOtp({ email: step.email, otp }), "That code didn't work. Check it, or send a new one.");
    if (!ok) return setCode("");
    onSignedIn();
    close(false);
  }

  const wait = step.kind === "code" ? Math.max(0, RESEND_AFTER_S - Math.floor((now - step.sentAt) / 1000)) : 0;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{step.kind === "email" ? "Sign in" : "Check your email"}</DialogTitle>
          <DialogDescription>
            {step.kind === "email" ? (
              "We'll email you a 6-digit code. No password needed; new here? This creates your account."
            ) : (
              <>
                Enter the code we sent to <span className="font-medium text-foreground">{step.email}</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step.kind === "email" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) send(email.trim());
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="signin-email">Email</FieldLabel>
                <Input id="signin-email" type="email" autoComplete="email" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </Field>
              {error && <Problem text={error} />}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy ? <Spinner /> : <MailIcon />}
                Send code
              </Button>
            </FieldGroup>
          </form>
        ) : (
          <FieldGroup>
            <Field className="items-center">
              <FieldLabel htmlFor="signin-code" className="sr-only">
                Sign-in code
              </FieldLabel>
              <InputOTP
                id="signin-code"
                maxLength={CODE_LENGTH}
                value={code}
                onChange={setCode}
                onComplete={verify}
                autoFocus
                disabled={busy}
                inputMode="numeric"
                autoComplete="one-time-code"
              >
                <InputOTPGroup>
                  {Array.from({ length: CODE_LENGTH }, (_, i) => (
                    <InputOTPSlot key={i} index={i} className="size-11 text-base" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <FieldDescription className="text-center">
                {busy ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Spinner className="size-3" /> Checking…
                  </span>
                ) : (
                  "It can take a minute to arrive. Check spam too."
                )}
              </FieldDescription>
            </Field>
            {error && <Problem text={error} />}
            <div className="flex items-center justify-between">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStep({ kind: "email" })}>
                <ArrowLeftIcon />
                Change email
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy || wait > 0} onClick={() => send(step.email)}>
                {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
              </Button>
            </div>
          </FieldGroup>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Better Auth messages are terse ("Invalid OTP"); say what to do instead. */
function friendly(msg?: string) {
  if (!msg) return undefined;
  if (/invalid otp|invalid code/i.test(msg)) return "That code isn't right. Check the email, or send a new code.";
  if (/expired/i.test(msg)) return "That code has expired. Send a new one.";
  if (/too many|attempts/i.test(msg)) return "Too many tries. Wait a minute, then send a new code.";
  return msg;
}

function Problem({ text }: { text: string }) {
  return (
    <Alert variant="destructive" className="border-destructive/50">
      <TriangleAlertIcon />
      <AlertDescription>{text}</AlertDescription>
    </Alert>
  );
}
