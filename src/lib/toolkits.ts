import data from "../../data/composio-toolkits.json";
import { type Toolkit, toolkitUrl } from "./toolkit-meta";
import { normName } from "./utils";

export * from "./toolkit-meta";

/** Composio's toolkit catalog (server only: it is ~250 KB). */
export const TOOLKITS = data.toolkits as Toolkit[];
export const TOOLKITS_SYNCED: string = data.syncedAt;
export const TOOLKITS_SOURCE: string = data.source;

const byName = new Map<string, Toolkit>();
const bySlug = new Map<string, Toolkit>();
for (const t of TOOLKITS) {
  if (!byName.has(normName(t.name))) byName.set(normName(t.name), t);
  bySlug.set(normName(t.slug), t);
}

/** The Composio toolkit for an app name ("Google Calendar" → GOOGLECALENDAR), or undefined. */
export function findToolkit(app: string | undefined): Toolkit | undefined {
  if (!app) return undefined;
  const n = normName(app);
  return byName.get(n) ?? bySlug.get(n) ?? byName.get(n.replace(/(api|app|oauth)$/, ""));
}

/** One paragraph of toolkit facts for the research prompt. */
export function toolkitBrief(t: Toolkit) {
  const managed =
    t.managed === true
      ? "Composio provides a managed OAuth app for it (users can connect without you registering an app; the consent screen shows Composio)"
      : t.managed === false
        ? "Composio does not provide a managed OAuth app: you must register your own OAuth app and give Composio its client ID and secret"
        : "it has no OAuth method in Composio";
  return `Composio toolkit ${t.slug} (${toolkitUrl(t)}): auth methods ${t.auth.join(", ")}; ${managed}; ${t.tools} tools, ${t.triggers} triggers.`;
}

export const toolkitBySlug = (slug: string | undefined) => (slug ? bySlug.get(normName(slug)) : undefined);

/**
 * Best guess at the toolkit a free-text request is about, before research runs: the part before ":" ("Calendly: read
 * meetings…"), else the longest capitalized toolkit name of 4+ letters in the text (short names like "Box" match too
 * many ordinary words).
 */
export function guessToolkit(query: string): Toolkit | undefined {
  const head = findToolkit(query.split(/[:–—]/)[0].trim());
  if (head) return head;
  let best: Toolkit | undefined;
  for (const t of TOOLKITS) {
    if (t.name.length < 4 || (best && t.name.length <= best.name.length)) continue;
    const re = new RegExp(`(^|[^A-Za-z0-9])${t.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^A-Za-z0-9])`);
    if (re.test(query)) best = t;
  }
  return best;
}

/** The toolkit's docs page as Markdown, cut before its tool reference: header facts plus Composio's FAQ for it. */
export const toolkitDocUrl = (t: Pick<Toolkit, "page">) => `${toolkitUrl(t)}.md`;
