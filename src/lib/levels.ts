import type { Difficulty, Evidence, Who } from "./types";

export const LEVELS = [
  { n: 1, key: "self", name: "Self-serve", desc: "Credentials in minutes. No provider review for the common case." },
  { n: 2, key: "review", name: "Review to list", desc: "Works right away. Review only if you want a public listing." },
  { n: 3, key: "audit", name: "Security audit", desc: "Verification, plus a paid third-party assessment for some permissions." },
  { n: 4, key: "partner", name: "Partner-gated", desc: "A person at the provider must approve you and create the app." },
] as const;

export type Level = (typeof LEVELS)[number];

export const levelOf = (k: Difficulty | string): Level => LEVELS.find((l) => l.key === k) ?? LEVELS[1];

export const EVIDENCE_LABEL: Record<Evidence, string> = { tested: "Tested", sourced: "Sourced", uncertain: "Unverified" };

export const WHO_LABEL: Record<Who, string> = { agent: "Agent", you: "You", provider: "Provider" };

/** Tailwind needs literal class names, so per-level classes are spelled out instead of built from `l${n}`. */
export const LEVEL_CLASS = {
  1: { text: "text-l1", bg: "bg-l1", bgSoft: "bg-l1/70", badge: "border-l1/30 bg-l1/10 text-l1", note: "border-l1/40 bg-l1/5" },
  2: { text: "text-l2", bg: "bg-l2", bgSoft: "bg-l2/70", badge: "border-l2/30 bg-l2/10 text-l2", note: "border-l2/40 bg-l2/5" },
  3: { text: "text-l3", bg: "bg-l3", bgSoft: "bg-l3/70", badge: "border-l3/30 bg-l3/10 text-l3", note: "border-l3/40 bg-l3/5" },
  4: { text: "text-l4", bg: "bg-l4", bgSoft: "bg-l4/70", badge: "border-l4/30 bg-l4/10 text-l4", note: "border-l4/40 bg-l4/5" },
} as const;

export const fmtDate = (d: string) => {
  const [y, m, dd] = d.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${dd}, ${y}`;
};
