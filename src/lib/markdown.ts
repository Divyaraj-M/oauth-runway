import { EVIDENCE_LABEL, WHO_LABEL, levelOf } from "./levels";
import type { Evidence, Guide } from "./types";

const ev = (e: Evidence, src?: string) => (src && e === "sourced" ? `[Sourced](${src})` : (EVIDENCE_LABEL[e] ?? "Unverified"));

export function toMarkdown(g: Guide): string {
  const l = levelOf(g.difficulty);
  const L: string[] = [];
  L.push(`# ${g.app} ${g.oauth_supported === false ? "connection (no OAuth offered)" : "OAuth app"} — setup & approval`);
  if (g._generated) L.push(`> Live draft from the agent. Unverified.`);
  L.push(`**Difficulty:** Level ${l.n} of 4 · ${l.name}`, ``, g.verdict, ``);
  L.push(`**Your work (create the app → first working connection):** ${g.hands_on.text}  `, `**Waiting:** best ${g.waiting.best} · normal ${g.waiting.normal} · worst ${g.waiting.worst}`, ``);
  L.push(`**Start now:** ${g.start_now}`, ``, `## Your case`);
  g.cases.forEach((c) => L.push(`- ${c.case} → ${c.outcome} _(${ev(c.ev, c.src)})_`));
  if (g.facts?.length) {
    L.push(``, `## Setup details`);
    g.facts.forEach((f) => L.push(`- **${f.q}** ${f.a} _(${ev(f.ev, f.src)})_`));
  }
  L.push(``, `## Steps`);
  g.steps.forEach((s, i) => L.push(`${i + 1}. **[${WHO_LABEL[s.who] ?? "You"}] ${s.title}** — ${s.detail} _(${ev(s.ev, s.src)})_`));
  L.push(``, `## Blockers`);
  g.blockers.forEach((b) => L.push(`- ${b.text} _(${ev(b.ev, b.src)})_`));
  L.push(``, `## Agent can do`);
  g.agent_can.forEach((x) => L.push(`- ${x}`));
  L.push(``, `## You must do`);
  g.you_must.forEach((x) => L.push(`- ${x}`));
  L.push(``, `## Not confirmed`);
  g.unverified.forEach((x) => L.push(`- ${x}`));
  L.push(``, `## Sources`);
  g.sources.forEach((s) => L.push(`- ${s.u ? `[${s.t}](${s.u})` : s.t}`));
  return L.join("\n");
}
