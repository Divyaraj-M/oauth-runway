"use client";

import { TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";

import { type AuthState, signInAction, signUpAction } from "@/app/auth/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth/client";

/** Sign in / create account: email + password (server action) or Google (Neon Auth social sign-in). */
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const next = useSearchParams().get("next") ?? "/";
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "sign-in" ? signInAction : signUpAction, null);
  const [google, setGoogle] = useState<"idle" | "busy" | string>("idle");
  const signUp = mode === "sign-up";
  const other = `/auth/${signUp ? "sign-in" : "sign-up"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <Card className="enter mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{signUp ? "Create your account" : "Sign in"}</CardTitle>
        <CardDescription>Sign in to generate guides, ask the agent, and keep your history across devices.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            disabled={google === "busy"}
            onClick={async () => {
              setGoogle("busy");
              try {
                await authClient.signIn.social({ provider: "google", callbackURL: `${location.origin}${next}` });
              } catch (e) {
                setGoogle(e instanceof Error ? e.message : "Google sign-in failed.");
              }
            }}
          >
            {google === "busy" && <Spinner />}
            Continue with Google
          </Button>
          {google !== "idle" && google !== "busy" && <FieldDescription className="text-destructive">{google}</FieldDescription>}

          <FieldSeparator>or with email</FieldSeparator>

          <form action={action} className="contents">
            <input type="hidden" name="next" value={next} />
            {signUp && (
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <Input id="name" name="name" autoComplete="name" required />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password" name="password" type="password" autoComplete={signUp ? "new-password" : "current-password"} minLength={signUp ? 8 : undefined} required />
              {signUp && <FieldDescription>At least 8 characters.</FieldDescription>}
            </Field>
            {state?.error && (
              <Alert variant="destructive" className="border-destructive/50">
                <TriangleAlertIcon />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={pending}>
              {pending && <Spinner />}
              {signUp ? "Create account" : "Sign in"}
            </Button>
          </form>

          <FieldDescription className="text-center">
            {signUp ? "Already have an account?" : "New here?"}{" "}
            <Link href={other} className="underline underline-offset-2 hover:text-foreground">
              {signUp ? "Sign in" : "Create an account"}
            </Link>
          </FieldDescription>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
