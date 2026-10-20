"use client";

import type { Guide } from "./types";
import { normName } from "./utils";

/**
 * Agent chat history per user per guide, stored in the database (table `chats`). The agent route saves each
 * question and answer; the panel loads the conversation when it opens. Key-like messages are blocked before sending.
 */
export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  /** Research steps shown under an answer ("Opened developers.linear.app/…"). */
  trace?: string[];
  at: string;
};

/** Reviewed guides use their key; saved generated guides "g:<id>"; legacy browser drafts their app name. */
export const chatId = (g: Guide, guideId?: string) => (guideId ? `g:${guideId}` : g._generated ? `draft:${normName(g.app)}` : g.key);

export async function loadChat(key: string): Promise<StoredMessage[]> {
  try {
    const res = await fetch(`/api/chats?key=${encodeURIComponent(key)}`, { cache: "no-store" });
    return res.ok ? ((await res.json()).messages as StoredMessage[]) : [];
  } catch {
    return [];
  }
}

export async function clearChat(key: string) {
  try {
    await fetch(`/api/chats?key=${encodeURIComponent(key)}`, { method: "DELETE" });
  } catch {}
}
