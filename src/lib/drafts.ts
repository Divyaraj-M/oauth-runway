"use client";

import { useSyncExternalStore } from "react";

import type { Draft } from "./agent-client";
import { normName } from "./utils";

/**
 * Generated guides the user has kept, in this browser only (localStorage), keyed by normalized app name.
 * They show in the library as Draft rows; they are never mixed up with reviewed guides.
 */
export type SavedDraft = Draft & { savedAt: string };

const KEY = "oauth-runway:drafts";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const readRaw = () => {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
};

function readAll(): Record<string, SavedDraft> {
  try {
    return JSON.parse(readRaw()) as Record<string, SavedDraft>;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, SavedDraft>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
  emit();
}

export const draftSlug = (app: string) => normName(app);

/** Saves (or replaces) the draft for this app and returns its slug. */
export function saveDraft(d: Draft): string {
  const slug = draftSlug(d.guide.app);
  writeAll({ ...readAll(), [slug]: { ...d, savedAt: new Date().toISOString() } });
  return slug;
}

export function removeDraft(slug: string) {
  const all = readAll();
  delete all[slug];
  writeAll(all);
}

export const loadDraft = (slug: string): SavedDraft | null => readAll()[slug] ?? null;

const subscribe = (l: () => void) => {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
};

/** All saved drafts; re-renders on change (also across tabs). Empty during server render. */
export function useDrafts(): Record<string, SavedDraft> {
  // Snapshot is the raw string so React compares by value; parse after.
  const raw = useSyncExternalStore(subscribe, readRaw, () => "{}");
  try {
    return JSON.parse(raw) as Record<string, SavedDraft>;
  } catch {
    return {};
  }
}
