"use client";

import { useSyncExternalStore } from "react";

/**
 * Bring-your-own-key settings. The key lives only in this browser (localStorage) and is sent to our API routes
 * in a request header, where it is used for that one request and never stored or logged.
 */
export type Provider = "anthropic" | "gemini";

export type AiSettings = {
  provider: Provider;
  apiKey: string;
  /** Gemini model id. Anthropic always uses claude-opus-5-5. */
  geminiModel: string;
  /** Google Search grounding needs a paid Gemini tier; off means URL context only (free tier). */
  geminiSearch: boolean;
};

// Flash-Lite first: on the free tier 3.8 Flash is often overloaded (503) or slow; the server falls back to Flash-Lite anyway.
export const GEMINI_MODELS = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (free tier, fast, reliable)" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (free tier, smarter, often busy)" },
] as const;

export const DEFAULT_SETTINGS: AiSettings = { provider: "gemini", apiKey: "", geminiModel: GEMINI_MODELS[0].id, geminiSearch: false };

const KEY = "oauth-runway:ai";
const listeners = new Set<() => void>();

export function loadSettings(): AiSettings {
  try {
    const s = localStorage.getItem(KEY);
    return s ? { ...DEFAULT_SETTINGS, ...(JSON.parse(s) as Partial<AiSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: AiSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
  listeners.forEach((l) => l());
}

export function clearSettings() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
  listeners.forEach((l) => l());
}

/** Headers our API routes read the key from. */
export function aiHeaders(s: AiSettings = loadSettings()): Record<string, string> {
  if (!s.apiKey) return {};
  return {
    "x-ai-provider": s.provider,
    "x-ai-key": s.apiKey,
    ...(s.provider === "gemini" ? { "x-ai-model": s.geminiModel, "x-ai-search": s.geminiSearch ? "1" : "0" } : {}),
  };
}

const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};

/** True once a key is saved; re-renders when settings change. */
export function useHasKey(): boolean {
  const raw = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      window.addEventListener("storage", l);
      return () => {
        listeners.delete(l);
        window.removeEventListener("storage", l);
      };
    },
    read,
    () => "",
  );
  try {
    return !!(raw && (JSON.parse(raw) as Partial<AiSettings>).apiKey);
  } catch {
    return false;
  }
}
