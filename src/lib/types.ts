/** Evidence label on every claim (`src`, on generated guides, is the opened page that backs a "sourced" claim). "uncertain" renders as "Unverified". A generated guide can never be "tested". */
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
  cases: { case: string; outcome: string; ev: Evidence; src?: string }[];
  steps: { who: Who; title: string; detail: string; ev: Evidence; src?: string }[];
  blockers: { text: string; ev: Evidence; src?: string }[];
  agent_can: string[];
  you_must: string[];
  unverified: string[];
  /** `u` is empty for first-hand sources that have no public page. */
  sources: { t: string; u: string }[];
  /** Provider website domain, used for the Logo.dev logo fallback on drafts. */
  domain?: string;
  /** Set on live drafts written by the agent; never on reviewed guides. */
  _generated?: boolean;
};

/** `domain` drives the Logo.dev fallback; a new integration only needs an entry here to get a logo. */
export type CatalogEntry = { key: string; app: string; provider: string; cat: string; domain?: string };

export type LogoSource = "bundled" | "svgl" | "brandbird" | "logo.dev" | "letter";

/**
 * Result of the logo waterfall (bundled SVGL component → SVGL API → BrandBird → Logo.dev → letter tile).
 * The first source that has the logo wins; `tried` lists every source checked, in order.
 */
export type LogoInfo = { source: LogoSource; local?: string; light?: string; dark?: string; tried: LogoSource[] };

/** What /api/generate returns once research finishes. */
export type GeneratePayload = {
  /** Share id once saved to the database (/g/<id>). */
  id?: string;
  guide: Guide;
  logo: LogoInfo;
  research: {
    model: string;
    searches: string[];
    opened: string[];
    seen: number;
    downgraded: number;
    /** `src` URLs the model cited that it never opened (why claims were downgraded). */
    rejected?: string[];
  };
};
