"use client";

import { aiHeaders } from "./ai-settings";
import type { GeneratePayload, Guide, LogoInfo } from "./types";

/**
 * Browser side of the agent. Both routes stream NDJSON: research events (`search`, `fetch`, `text`)
 * followed by `done` (with the payload) or `error`. The user's own key (Settings) rides along in request headers.
 */

/** Asks the header's Settings button to open (used when no key is saved). */
export const openAiSettings = () => window.dispatchEvent(new Event("open-ai-settings"));

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AgentEvent =
  | { type: "search"; query: string }
  | { type: "fetch"; url: string }
  | { type: "note"; text: string }
  | { type: "text"; delta: string }
  | { type: "done"; payload?: GeneratePayload; research?: { searches: string[]; opened: string[] } }
  | { type: "error"; message: string };

async function streamEvents(url: string, body: unknown, onEvent: (e: AgentEvent) => void): Promise<AgentEvent & { type: "done" }> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", ...aiHeaders() }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    if (data?.code === "no_key") openAiSettings();
    throw new Error(data?.message || (res.status === 429 ? "Too many requests right now. Wait a minute and try again." : "Something went wrong. Try again."));
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let done: (AgentEvent & { type: "done" }) | null = null;
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const e = JSON.parse(line) as AgentEvent;
      if (e.type === "error") throw new Error(e.message);
      if (e.type === "done") done = e;
      onEvent(e);
    }
  }
  if (!done) throw new Error("The research stopped before finishing. Try again.");
  return done;
}

export async function askAgent(guide: Guide, messages: ChatMessage[], onEvent: (e: AgentEvent) => void) {
  await streamEvents("/api/agent", { guide, messages }, onEvent);
}

export async function generateGuide(query: string, onEvent: (e: AgentEvent) => void): Promise<GeneratePayload> {
  const done = await streamEvents("/api/generate", { query }, onEvent);
  if (!done.payload) throw new Error("The agent's answer came back malformed. Try again.");
  return done.payload;
}

const DRAFT_KEY = "oauth-runway:draft";
export type Draft = { guide: Guide; logo?: LogoInfo; research?: GeneratePayload["research"] };

export function saveDraft(d: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {}
}

export function loadDraft(): Draft | null {
  try {
    const s = sessionStorage.getItem(DRAFT_KEY);
    return s ? (JSON.parse(s) as Draft) : null;
  } catch {
    return null;
  }
}
