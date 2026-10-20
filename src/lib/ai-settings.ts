"use client";

import type { AiSettingsSummary } from "./db";

/**
 * Bring-your-own-key settings, stored on the user's account: the server encrypts the key (AES-256-GCM) and only
 * ever returns its last 4 characters. Nothing is kept in the browser, so signing out leaves no key behind.
 */
export type Provider = "anthropic" | "gemini";

// Flash-Lite first: on the free tier 3.8 Flash is often overloaded (503) or slow; the server falls back to Flash-Lite anyway.
export const GEMINI_MODELS = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (free tier, fast, reliable)" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (free tier, smarter, often busy)" },
] as const;

export type SettingsInput = { provider: Provider; apiKey?: string; model: string; search: boolean };

async function call(method: "PUT" | "DELETE", body?: SettingsInput): Promise<{ ai: AiSettingsSummary }> {
  const res = await fetch("/api/settings", { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Couldn't save settings.");
  return data;
}

export const saveSettings = (s: SettingsInput) => call("PUT", s);
export const removeKey = () => call("DELETE");

/** Tests a key typed into Settings (before saving), or the saved key when apiKey is empty. */
export async function testKey(s: SettingsInput): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch("/api/key-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(s.apiKey ? s : {}) });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok ? { ok: true } : { ok: false, message: data.message || "The key didn't work." };
  } catch {
    return { ok: false, message: "Couldn't reach the server." };
  }
}

/* ---------- one-time migration from the old browser-stored key ---------- */

const LEGACY_KEY = "oauth-runway:ai";

/** A key an earlier version kept in localStorage, if any. */
export function readLegacy(): SettingsInput | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    const s = raw ? (JSON.parse(raw) as { provider?: Provider; apiKey?: string; geminiModel?: string; geminiSearch?: boolean }) : null;
    return s?.apiKey && s.provider ? { provider: s.provider, apiKey: s.apiKey, model: s.geminiModel ?? GEMINI_MODELS[0].id, search: !!s.geminiSearch } : null;
  } catch {
    return null;
  }
}

export function clearLegacy() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}
