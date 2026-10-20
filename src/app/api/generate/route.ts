import { CATALOG } from "@/lib/guides";
import { resolveLogoWithin } from "@/lib/logos";
import { GENERATE_SYSTEM, generateUser } from "@/lib/prompts";
import { credentialsFrom, modelOf, ndjson, noKey, research } from "@/lib/research";
import { looksLikeSecret } from "@/lib/secrets";
import type { Evidence, GeneratePayload, Guide } from "@/lib/types";
import { normName } from "@/lib/utils";

// Research with several searches and page fetches can take a few minutes.
export const maxDuration = 300;

/** Compare URLs loosely: protocol, www, trailing slash and fragment don't matter. */
const urlKey = (u: string) =>
  u
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();

export async function POST(req: Request) {
  const creds = credentialsFrom(req);
  if (!creds) return noKey();
  const body = (await req.json().catch(() => null)) as { query?: unknown } | null;
  const query = typeof body?.query === "string" ? body.query.trim().slice(0, 1000) : "";
  if (!query) return Response.json({ message: "Describe the app and what your agent does in it." }, { status: 400 });
  // Same check as the browser, repeated here so a key never reaches the model or logs.
  if (looksLikeSecret(query)) return Response.json({ message: "Not sent: this looks like a credential." }, { status: 400 });

  return ndjson(creds, async (send) => {
    const { text, log } = await research({
      creds,
      system: GENERATE_SYSTEM,
      messages: [{ role: "user", content: generateUser(query) }],
      emit: send,
      effort: "medium",
    });

    const raw = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    let g: Guide;
    try {
      g = JSON.parse(raw);
    } catch {
      send({ type: "error", message: "The agent's answer came back malformed. Try again." });
      return;
    }

    g.key = "draft";
    g.app ||= query;
    g.provider ||= g.app;
    g.hands_on ||= { text: "Unknown", days: 0.5 };
    g.waiting ||= { best: "Unknown", normal: "Unknown", worst: "Unknown", days: 1 };
    for (const k of ["cases", "steps", "blockers", "agent_can", "you_must", "unverified", "sources"] as const) g[k] ||= [];
    g._generated = true;

    // Durations must be short ranges ("1–3 hours"); models sometimes put a sentence here. Keep the layout honest.
    const dur = (v: unknown) => (typeof v === "string" && v.trim().length > 0 && v.length <= 28 ? v.trim() : "Unknown");
    const badDur = [g.hands_on.text, g.waiting.best, g.waiting.normal, g.waiting.worst].some((v) => dur(v) === "Unknown" && v !== "Unknown");
    g.hands_on.text = dur(g.hands_on.text);
    g.waiting = { ...g.waiting, best: dur(g.waiting.best), normal: dur(g.waiting.normal), worst: dur(g.waiting.worst) };
    if (badDur) g.unverified.push("The agent didn't give a clear time range for some durations; they show as Unknown.");

    // Evidence rules, enforced here rather than trusted from the model:
    // a generated guide is never Tested, and Sourced needs a page the model actually opened.
    const opened = new Set(log.opened.map(urlKey));
    // A cited URL counts if it, or the page it redirects to, was opened.
    const aliases = new Map(Object.entries(log.aliases).map(([from, to]) => [urlKey(from), urlKey(to)]));
    const wasOpened = (u: string) => opened.has(urlKey(u)) || opened.has(aliases.get(urlKey(u)) ?? "");
    let downgraded = 0;
    const rejected = new Set<string>();
    for (const claim of [...g.steps, ...g.blockers, ...g.cases]) {
      const ev: Evidence = claim.ev === "sourced" && claim.src && wasOpened(claim.src) ? "sourced" : "uncertain";
      if (claim.ev !== ev) {
        downgraded++;
        if (claim.src) rejected.add(claim.src);
      }
      claim.ev = ev;
      if (ev !== "sourced") delete claim.src;
    }
    // Sources list: only pages that were opened. Anything the model listed without opening is dropped.
    g.sources = g.sources.filter((s) => s.u && wasOpened(s.u));
    for (const u of log.opened) if (!g.sources.some((s) => urlKey(s.u) === urlKey(u))) g.sources.push({ t: u, u });

    const known = CATALOG.find((c) => normName(c.app) === normName(g.app));
    const logo = await resolveLogoWithin({ key: known?.key, app: g.app, provider: g.provider, domain: known?.domain ?? g.domain });

    const payload: GeneratePayload = {
      guide: g,
      logo,
      research: { model: modelOf(creds), searches: log.searches, opened: log.opened, seen: log.seen.length, downgraded, rejected: [...rejected] },
    };
    send({ type: "done", payload });
  });
}
