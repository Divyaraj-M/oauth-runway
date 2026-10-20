"use server";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";

export type AuthState = { error: string } | null;

/** Only same-site paths, so ?next= can't send people elsewhere. */
const safeNext = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "/");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
};

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const { error } = await auth.signIn.email({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
  if (error) return { error: error.message || "Couldn't sign in. Check your email and password." };
  redirect(safeNext(form.get("next")));
}

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters for the password." };
  const { error } = await auth.signUp.email({ name: String(form.get("name") ?? ""), email: String(form.get("email") ?? ""), password });
  if (error) return { error: error.message || "Couldn't create the account." };
  redirect(safeNext(form.get("next")));
}
