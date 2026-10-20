/** Evidence label on every claim. "uncertain" renders as "Unverified". A generated guide can never be "tested". */
export type Evidence = "tested" | "sourced" | "uncertain";
export type Difficulty = "self" | "review" | "audit" | "partner";
export type Who = "agent" | "you" | "provider";

export type Guide = {
  key: string;
  /** ISO date the guide was last checked by hand. */
  checked?: string;
  app: string;
  provider: string;
  difficulty: Difficulty;
  verdict: string;
  hands_on: { text: string; days: number };
  waiting: { best: string; normal: string; worst: string; days: number };
  start_now: string;
  cases: { case: string; outcome: string; ev: Evidence }[];
  steps: { who: Who; title: string; detail: string; ev: Evidence }[];
  blockers: { text: string; ev: Evidence }[];
  agent_can: string[];
  you_must: string[];
  unverified: string[];
  /** `u` is empty for first-hand sources that have no public page. */
  sources: { t: string; u: string }[];
  /** Set on live drafts written by the agent; never on reviewed guides. */
  _generated?: boolean;
};

export type CatalogEntry = { key: string; app: string; provider: string; cat: string };
