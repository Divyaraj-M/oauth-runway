/** Pure helpers for Composio toolkits; safe to import in client components (the catalog data lives in toolkits.ts). */

/**
 * One Composio toolkit, synced from docs.composio.dev/toolkits by scripts/sync-toolkits.mjs.
 * `managed`: true = Composio provides the OAuth app, false = bring your own, null = the toolkit has no OAuth.
 */
export type Toolkit = {
  slug: string;
  name: string;
  page: string;
  tools: number;
  triggers: number;
  auth: string[];
  managed: boolean | null;
  category?: string;
  description?: string;
};

const OAUTH = new Set(["OAUTH2", "OAUTH1", "DCR_OAUTH", "S2S_OAUTH2"]);
export const isOAuth = (t: Pick<Toolkit, "auth">) => t.auth.some((a) => OAUTH.has(a));

export const AUTH_LABEL: Record<string, string> = {
  OAUTH2: "OAuth 2",
  OAUTH1: "OAuth 1",
  DCR_OAUTH: "OAuth (dynamic registration)",
  S2S_OAUTH2: "Server-to-server OAuth",
  API_KEY: "API key",
  BEARER_TOKEN: "Bearer token",
  BASIC: "Basic auth",
  BASIC_WITH_JWT: "Basic auth + JWT",
  GOOGLE_SERVICE_ACCOUNT: "Service account",
  SAML: "SAML",
  NO_AUTH: "No auth",
};
export const authLabel = (a: string) => AUTH_LABEL[a] ?? a.replace(/_/g, " ").toLowerCase();

/** The human docs page (not the .md file). */
export const toolkitUrl = (t: Pick<Toolkit, "page">) => `https://docs.composio.dev/toolkits/${t.page}`;
