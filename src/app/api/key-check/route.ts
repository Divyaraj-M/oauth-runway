import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

import { currentUser, signInRequired } from "@/lib/auth/server";
import { logEvent } from "@/lib/db";
import { type Credentials, credentialsFor, credentialsFromInput, describeError, noKey } from "@/lib/research";

/**
 * Checks a key with a free listing call (no tokens spent). Body { provider, apiKey, model } tests a key typed into
 * Settings before saving; an empty body tests the key already saved on the account.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return signInRequired();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const creds: Credentials | null = body.apiKey ? credentialsFromInput(body) : await credentialsFor(user.id);
  if (!creds) return noKey();
  try {
    if (creds.provider === "anthropic") await new Anthropic({ apiKey: creds.apiKey }).models.list({ limit: 1 });
    else await new GoogleGenAI({ apiKey: creds.apiKey }).models.get({ model: creds.model });
    void logEvent({ userId: user.id, kind: "key_check", app: creds.provider, ok: true });
    return Response.json({ ok: true });
  } catch (err) {
    const { status, message } = describeError(err);
    void logEvent({ userId: user.id, kind: "key_check", app: creds.provider, ok: false, detail: { error: message } });
    return Response.json({ ok: false, message }, { status });
  }
}
