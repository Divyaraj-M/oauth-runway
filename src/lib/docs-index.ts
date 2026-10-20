/**
 * Finds real documentation pages for a provider so a model with no web search (free-tier Gemini) reads pages
 * that exist instead of guessing URLs. Reads llms.txt (the docs index many developer sites publish for AI tools)
 * from the provider's likely docs hosts, then ranks the listed pages by relevance to OAuth app setup.
 */

const TOPICS: [RegExp, number][] = [
  [/oauth|authori[sz]|auth\b|consent/i, 6],
  [/scope|permission/i, 5],
  [/token|refresh|expir/i, 4],
  [/redirect|callback/i, 4],
  [/creat\w* (an? )?(app|integration)|register|app.?setup|getting.?started|quick.?start|developer.?(account|portal)/i, 4],
  [/review|approv|verif|publish|marketplace|listing|partner/i, 4],
  [/pric|plan|billing|paid|premium|enterprise/i, 3],
  [/sandbox|test|developer.?account/i, 3],
  [/webhook/i, 2],
  [/rate.?limit|limits/i, 2],
];
const NOISE = /changelog|release.?notes|blog|careers|legal|status|\/v\d+\/[^/]*\/(get|post|put|delete|patch)-/i;

type Page = { url: string; title: string; score: number };

/** Hosts worth checking for llms.txt: docs subdomains of the provider plus hosts of the model's own guesses. */
export function docsHosts(domain: string | undefined, guesses: string[]): string[] {
  const hosts = new Set<string>();
  const d = domain?.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  if (d && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) for (const p of ["developer.", "developers.", "docs.", "", "help."]) hosts.add(p + d);
  for (const u of guesses) {
    try {
      hosts.add(new URL(u).hostname);
    } catch {}
  }
  return [...hosts].slice(0, 8);
}

async function fetchText(url: string, maxBytes = 400_000): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(6000) });
    if (!res.ok || !/text\/(plain|markdown)/.test(res.headers.get("content-type") ?? "")) return null;
    const text = await res.text();
    return text.slice(0, maxBytes);
  } catch {
    return null;
  }
}

/** Ranked real pages from the provider's llms.txt files (empty if none publish one). */
export async function findDocPages(hosts: string[], limit = 14): Promise<{ pages: Page[]; indexes: string[] }> {
  const found = await Promise.all(hosts.map(async (h) => [h, await fetchText(`https://${h}/llms.txt`)] as const));
  const pages = new Map<string, Page>();
  const indexes: string[] = [];
  for (const [host, text] of found) {
    if (!text) continue;
    indexes.push(`${host}/llms.txt`);
    // Markdown links "[Title](https://…)" carry a title; bare URLs fall back to their path.
    for (const m of text.matchAll(/\[([^\]]{1,160})\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)<>"']+)/g)) {
      const url = (m[2] ?? m[3]).replace(/[.,;]+$/, "");
      if (NOISE.test(url) || pages.has(url)) continue;
      const title = m[1] ?? new URL(url).pathname.replace(/[-_/]+/g, " ").trim();
      const hay = `${title} ${url}`;
      const score = TOPICS.reduce((s, [re, w]) => s + (re.test(hay) ? w : 0), 0);
      if (score > 0) pages.set(url, { url, title, score });
    }
  }
  return { pages: [...pages.values()].sort((a, b) => b.score - a.score).slice(0, limit), indexes };
}

/** Reads a docs page as text (Markdown/plain as-is, HTML with tags stripped), capped so several fit in one prompt. */
export async function readPage(url: string, maxChars = 7000): Promise<string | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    let text = await res.text();
    if (/html/.test(type))
      text = text
        .replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&");
    else if (!/text\/|markdown|json/.test(type)) return null;
    text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return text.length > 200 ? text.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}
