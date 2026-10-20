import { cacheLife } from "next/cache";

import { LOGOS } from "@/components/guide/logos";

import type { CatalogEntry, LogoInfo, LogoSource } from "./types";
import { normName as norm } from "./utils";

type LogoQuery = { key?: string; app: string; provider?: string; domain?: string };

/** "Outlook" is listed as "Microsoft Outlook" upstream, so try the provider-prefixed name too. */
const candidates = (q: LogoQuery) => [...new Set([q.app, q.provider ? `${q.provider} ${q.app}` : q.app])];

type SvglEntry = { title: string; route: string | { light: string; dark: string } };

/** Whole SVGL catalog in one request, cached as SVGL's API docs ask (it is rate-limited). */
async function svglIndex(): Promise<Map<string, SvglEntry>> {
  "use cache";
  cacheLife("days");
  try {
    const res = await fetch("https://api.svgl.app", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return new Map();
    const all = (await res.json()) as SvglEntry[];
    return new Map(all.map((x) => [norm(x.title), x]));
  } catch {
    return new Map();
  }
}

/** BrandBird has no API; its logomarks are public files named "<App> Logomark.svg", so probe by name. */
async function brandbird(name: string): Promise<string | null> {
  "use cache";
  cacheLife("days");
  const url = `https://storage.googleapis.com/brandbird/assets/company-logos/Logomark/${encodeURIComponent(`${name} Logomark.svg`)}`;
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return res.ok && res.headers.get("content-type")?.includes("svg") ? url : null;
  } catch {
    return null;
  }
}

/** Logo.dev by domain. `fallback=404` asks for a 404 instead of a generated monogram, so a miss falls through. */
async function logoDev(domain: string, token: string): Promise<string | null> {
  "use cache";
  cacheLife("days");
  const url = `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=64&format=png&retina=true&fallback=404`;
  try {
    // GET, not HEAD: img.logo.dev answers HEAD with 404 even when the logo exists.
    // Read the (small) body rather than cancelling it: res.body.cancel() never resolves inside "use cache".
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    await res.arrayBuffer();
    return res.ok && res.headers.get("content-type")?.startsWith("image/") ? url : null;
  } catch {
    return null;
  }
}

/** Waterfall: each source is tried in order and the first hit wins. */
export async function resolveLogo(q: LogoQuery): Promise<LogoInfo> {
  const tried: LogoSource[] = [];

  tried.push("bundled");
  if (q.key && LOGOS[q.key]) return { source: "bundled", local: q.key, tried };

  tried.push("svgl");
  const svgl = await svglIndex();
  const hit = candidates(q)
    .map((n) => svgl.get(norm(n)))
    .find(Boolean);
  if (hit) {
    const r = hit.route;
    return typeof r === "string" ? { source: "svgl", light: r, tried } : { source: "svgl", light: r.light, dark: r.dark, tried };
  }

  tried.push("brandbird");
  for (const n of candidates(q)) {
    const url = await brandbird(n);
    if (url) return { source: "brandbird", light: url, tried };
  }

  // Publishable token (pk_…); it ends up in the image URL the browser loads, which is how Logo.dev expects it to be used.
  // Only publishable tokens: a secret key (sk_…) here would be exposed to every visitor through the image URL.
  const token = process.env.LOGO_DEV_TOKEN?.startsWith("pk_") ? process.env.LOGO_DEV_TOKEN : undefined;
  if (q.domain && token) {
    tried.push("logo.dev");
    const url = await logoDev(q.domain, token);
    if (url) return { source: "logo.dev", light: url, tried };
  }

  tried.push("letter");
  return { source: "letter", tried };
}

/** resolveLogo with a ceiling, for request-time callers: a slow logo source must never hold up a guide. */
export function resolveLogoWithin(q: LogoQuery, ms = 8000): Promise<LogoInfo> {
  const fallback: LogoInfo = { source: "letter", tried: ["bundled", "svgl", "brandbird", "letter"] };
  return Promise.race([resolveLogo(q).catch(() => fallback), new Promise<LogoInfo>((r) => setTimeout(() => r(fallback), ms))]);
}

export async function resolveLogos(catalog: CatalogEntry[]): Promise<Record<string, LogoInfo>> {
  const entries = await Promise.all(catalog.map(async (c) => [c.key, await resolveLogo(c)] as const));
  return Object.fromEntries(entries);
}
