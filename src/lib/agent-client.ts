"use client";

import type { Guide } from "./types";

/**
 * Browser side of the agent. Both calls stream plain text from an API route.
 * The routes (`/api/agent`, `/api/generate`) arrive in step 2; until then a 404 surfaces as a readable error.
 */

export type ChatMessage = { role: "user" | "assistant"; content: string };

async function streamText(url: string, body: unknown, onText: (soFar: string) => void): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (res.status === 404) throw new Error("The agent isn't connected yet. Add ANTHROPIC_API_KEY to .env and the agent API route.");
  if (res.status === 429) throw new Error("Too many requests right now. Wait a minute and try again.");
  if (!res.ok || !res.body) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || "Something went wrong. Try again.");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true });
    onText(text);
  }
  return text;
}

export function askAgent(guide: Guide, messages: ChatMessage[], onText: (soFar: string) => void) {
  return streamText("/api/agent", { guide, messages }, onText);
}

export async function generateGuide(query: string, onText: (soFar: string) => void): Promise<Guide> {
  const raw = (await streamText("/api/generate", { query }, onText)).replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
  let g: Guide;
  try {
    g = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
  } catch {
    throw new Error("The agent's answer came back malformed. Try again.");
  }
  g.key = "draft";
  g.app ||= query;
  g.provider ||= g.app;
  g.hands_on ||= { text: "Unknown", days: 0.5 };
  g.waiting ||= { best: "Unknown", normal: "Unknown", worst: "Unknown", days: 1 };
  for (const k of ["cases", "steps", "blockers", "agent_can", "you_must", "unverified", "sources"] as const) g[k] ||= [];
  // A generated guide can never be Tested.
  for (const x of [...g.steps, ...g.blockers, ...g.cases]) if (x.ev === "tested") x.ev = "uncertain";
  g._generated = true;
  return g;
}

const DRAFT_KEY = "oauth-runway:draft";

export function saveDraft(g: Guide) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(g));
  } catch {}
}

export function loadDraft(): Guide | null {
  try {
    const s = sessionStorage.getItem(DRAFT_KEY);
    return s ? (JSON.parse(s) as Guide) : null;
  } catch {
    return null;
  }
}
