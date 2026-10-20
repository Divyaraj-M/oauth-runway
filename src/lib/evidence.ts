import type { Evidence } from "./types";

/**
 * Server-side checks that an evidence label matches what the claim actually says.
 * - Hedged or "not found" answers can't be Sourced.
 * - Claims that something doesn't exist (no review, no wait, no cap) can't be proven by a page: "Not documented".
 * - Composio facts can only be Sourced to Composio's own docs, not the provider's.
 */
const NOT_FOUND = /\bnot (explicitly |clearly |publicly )?(detailed|documented|found|mentioned|stated|specified|listed|covered|described)\b|\bno (information|details?|mention)\b|\bunclear\b|\bunknown\b/i;
const HEDGED = /\bmay vary\b|\bvaries\b|\btypically\b|\busually\b|\blikely\b|\bprobably\b|\bmight\b|\bspecific scopes are required\b/i;
const ABSENCE =
  /\bno (public |manual |formal |app )?(review|approval|verification|wait|waiting|user cap|cap|gate|limit on users)\b|\b(doesn't|does not|don't|do not|never|neither|nor|without)\b[^.]{0,50}\b(trigger|require|need)s?\b[^.]{0,40}\b(review|approval|verification)\b|^no wait$/i;

export function checkEvidence(text: string, ev: Evidence, src: string | undefined): Evidence {
  if (ev !== "sourced") return NOT_FOUND.test(text) ? "absent" : ev;
  if (NOT_FOUND.test(text)) return "absent";
  if (ABSENCE.test(text)) return "absent";
  if (HEDGED.test(text)) return "uncertain";
  if (/composio/i.test(text) && !/composio\.dev/i.test(src ?? "")) return "uncertain";
  return "sourced";
}
