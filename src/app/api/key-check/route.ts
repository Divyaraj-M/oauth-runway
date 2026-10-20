import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

import { currentUser } from "@/lib/auth/server";
import { logEvent } from "@/lib/db";
import { credentialsFrom, describeError, noKey } from "@/lib/research";

/** Checks the caller's key with a free listing call (no tokens spent). Says nothing about credit balance or quotas. */
export async function POST(req: Request) {
  const creds = credentialsFrom(req);
  if (!creds) return noKey();
  try {
    if (creds.provider === "anthropic") await new Anthropic({ apiKey: creds.apiKey }).models.list({ limit: 1 });
    else await new GoogleGenAI({ apiKey: creds.apiKey }).models.get({ model: creds.model });
    void logEvent({ userId: (await currentUser())?.id ?? null, kind: "key_check", app: creds.provider, ok: true });
    return Response.json({ ok: true });
  } catch (err) {
    const { status, message } = describeError(err);
    void logEvent({ userId: (await currentUser())?.id ?? null, kind: "key_check", app: creds.provider, ok: false, detail: { error: message } });
    return Response.json({ ok: false, message }, { status });
  }
}
