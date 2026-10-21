// Refreshes data/composio-toolkits.json from Composio's public docs: node scripts/sync-toolkits.mjs
// Source: https://docs.composio.dev/toolkits.md (every toolkit) and /toolkits/managed-auth.md (who provides the OAuth app).
// OAuth toolkits also get their category and one-line description from their own page.
import { writeFileSync } from "node:fs";

const BASE = "https://docs.composio.dev";
const get = async (path) => {
  const res = await fetch(BASE + path, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.text();
};

const OAUTH = new Set(["OAUTH2", "OAUTH1", "DCR_OAUTH", "S2S_OAUTH2"]);

const index = await get("/toolkits.md");
const ROW = /^\| \[(.+)\]\(\/toolkits\/(.+?)\.md\) \| `(.+?)` \| (\d+) \| (\d+) \| (.+?) \| (.+?) \|$/;
const toolkits = [];
for (const line of index.split("\n")) {
  const m = ROW.exec(line);
  if (!m) continue;
  const [, name, page, slug, tools, triggers, auth, managed] = m;
  toolkits.push({
    slug,
    name,
    page,
    tools: Number(tools),
    triggers: Number(triggers),
    auth: auth.split(",").map((s) => s.trim()).filter(Boolean),
    // "Yes" = Composio provides the OAuth app, "No" = bring your own, "—" = no OAuth.
    managed: managed === "Yes" ? true : managed === "No" ? false : null,
  });
}
const claimed = Number(/supports (\d+) toolkits/.exec(index)?.[1] ?? 0);
if (toolkits.length < claimed * 0.95) throw new Error(`parsed ${toolkits.length} of ${claimed} toolkits; the table format changed`);

// managed-auth.md is the authoritative list for the Managed App column; warn if the two disagree.
const managedDoc = await get("/toolkits/managed-auth.md");
const [yesPart, noPart = ""] = managedDoc.split("## Bring your own OAuth app");
const slugsIn = (s) => new Set([...s.matchAll(/\| `([A-Z0-9_]+)` \|/g)].map((m) => m[1]));
const yes = slugsIn(yesPart);
const no = slugsIn(noPart);
for (const t of toolkits) {
  if (yes.has(t.slug)) t.managed = true;
  else if (no.has(t.slug)) t.managed = false;
}

// Category and description from each OAuth toolkit's own page (header only).
const oauth = toolkits.filter((t) => t.auth.some((a) => OAUTH.has(a)));
let done = 0;
async function enrich(t) {
  try {
    const md = await get(`/toolkits/${t.page}.md`);
    const head = md.split(/\n## /)[0];
    t.category = /\*\*Category:\*\* (.+)/.exec(head)?.[1]?.trim();
    t.description = head.split("\n").find((l) => l && !/^(---|#|-|\w+:|canonical|markdown)/.test(l.trim()) && l.length > 30)?.trim();
  } catch (e) {
    console.warn(`skip ${t.slug}: ${e.message}`);
  }
  if (++done % 50 === 0) console.log(`${done}/${oauth.length} pages`);
}
for (let i = 0; i < oauth.length; i += 12) await Promise.all(oauth.slice(i, i + 12).map(enrich));

const out = { source: `${BASE}/toolkits`, syncedAt: new Date().toISOString().slice(0, 10), total: toolkits.length, toolkits };
writeFileSync(new URL("../data/composio-toolkits.json", import.meta.url), JSON.stringify(out) + "\n");
console.log(`${toolkits.length} toolkits, ${oauth.length} with OAuth, ${toolkits.filter((t) => t.managed).length} Composio-managed`);
