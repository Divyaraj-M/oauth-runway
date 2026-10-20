"use client";

import type { Guide } from "./types";
import { normName } from "./utils";

/**
 * Agent chat history per guide, kept in this browser (localStorage) so reopening a guide shows the conversation.
 * Never holds secrets: key-like messages are blocked before they are sent or stored.
 */
export type StoredMessage = {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  /** Research steps shown under an answer ("Opened developers.linear.app/…"). */
  trace?: string[];
  at: string;
};

const KEY = "oauth-runway:chats";
const MAX_PER_GUIDE = 60;

/** Reviewed guides use their key; drafts use their app name, matching src/lib/drafts.ts. */
export const chatId = (g: Guide) => (g._generated ? `draft:${normName(g.app)}` : g.key);

function readAll(): Record<string, StoredMessage[]> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, StoredMessage[]>;
  } catch {
    return {};
  }
}

export function loadChat(id: string): StoredMessage[] {
  return readAll()[id] ?? [];
}

export function saveChat(id: string, messages: StoredMessage[]) {
  try {
    const all = readAll();
    if (messages.length) all[id] = messages.slice(-MAX_PER_GUIDE);
    else delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}
