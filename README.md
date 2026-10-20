# OAuth Runway

**How long until your OAuth app is approved?** Look up an app, or describe one, and get a guide to creating its OAuth app and getting it approved: how hard it is, your work time vs. the provider's waiting time, what blocks approval, what to start now, and who does each step (Agent / You / Provider). For an app that isn't in the library, an agent researches it live and writes a guide you can keep and share.

## The problem it solves

Before an AI agent can act in a user's Gmail, Slack or Aircall, the developer often needs their own OAuth app with that provider. Provider docs and Composio's auth guides explain *the clicks*. They rarely say *how long*: whether it's an hour of self-serve setup or two months of partner review, which scope pulls you into a paid security audit, or which email resets your place in a queue. OAuth Runway answers those questions first.

## Setup

```bash
npm install
cp .env.example .env    # optional: LOGO_DEV_TOKEN (publishable pk_…) for extra logos
npm run dev             # http://localhost:3000
```

Then click **Add AI key** (top right) and paste your own key:

- **Google Gemini (free):** create a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) **in a project with no billing linked**. A billed project with depleted prepay credits is refused ("prepayment credits are depleted"), even for free models. Leave *Use Google Search* off on the free tier.
- **Anthropic Claude:** a key from console.anthropic.com with API credits. Uses Claude Opus 5.5 with web search and web fetch, which gives the best-sourced guides.

**Test key** checks it with a free call. The key is stored only in your browser.

## What's in it

- **Library:** 4 hand-reviewed guides chosen to cover all four difficulty levels, plus 16 more catalog apps the agent can research.
  - Notion: L1 Self-serve
  - Slack: L2 Review to list
  - Gmail: L3 Security audit
  - Aircall: L4 Partner-gated
- **Live generation:** type an app name or website and what your agent should do. The agent researches it and streams progress (pages it opens). The guide is saved to your list as a **Draft**.
- **Guide page:**
  - Difficulty and timeline at a glance.
  - *Start now* (the one action that shortens the wait).
  - Tabs: *Your case* (how your situation changes the path), *Steps*, *Blockers*, *Who does what*, *Sources*.
- **Agent chat:** ask about any step; it can draft the plan doc, scope list or reviewer email. Chats are saved per guide.
- **Share:**
  - Reviewed guides: copy link.
  - Generated guides: copy share link (the guide travels in the URL), or Copy as Markdown.

## Key decisions

1. **Time and gates, not clicks.** The guide leads with a difficulty level (1–4) and two clocks: your hands-on work vs. waiting on the provider, with best/normal/worst ranges. That is the information developers can't get from docs.
2. **Four difficulty levels by what gates you:**
   - Self-serve.
   - Review only to list publicly.
   - Paid security audit for some scopes.
   - A person at the provider must approve you.

   Same level, same planning implications.
3. **Every claim carries evidence:** *Tested* (done first-hand), *Sourced* (a page actually read), *Unverified*. For generated guides this is **enforced on the server**, not trusted from the model:
   - Nothing generated can be Tested.
   - Sourced survives only if the claim's URL (or the page it redirects to) was actually opened during research.
   - Sources the model didn't open are dropped.
4. **"Your case" first.** The same app can be L1 or L3 depending on scopes or who connects (internal vs. customers), so the case table is the default tab.
5. **Agent vs. you.** Each step says who does it. The agent produces artifacts (plan docs, scope lists, justification text), not just descriptions.
6. **Bring your own AI key, no server secrets.** Keys stay in the user's browser, are sent per request in a header, and are never stored or logged (errors are redacted). Key-like text is blocked in search and chat on both client and server. Gemini works on the free tier: without Google Search, the agent first picks official pages, then opens them with URL context.
7. **No database.** Drafts and chats live in the browser. Share links compress the whole guide into the URL fragment, which is never sent to a server.
8. **Logos by waterfall:** bundled SVGL → SVGL API → BrandBird → Logo.dev → letter tile, resolved on the server and cached for a day. A new catalog entry with a `domain` gets a logo with no code change.

## Verification

See [VERIFICATION.md](VERIFICATION.md). Sample result:

- **Gmail:** scope tiers, annual CASA, the 100-user cap and the internal exemption confirmed.
- **Slack:** one claim corrected (queue reset applies only to the preliminary review); review times now sourced to Slack's own guide.
- **Aircall:** timelines added (demo review 1–5 days, publication 3–5 days, decommissioning rules).
- **Notion:** guide changed after its docs revealed a review step before the authorization URL appears.

## Limitations

- **4 reviewed guides, not 100.** The other catalog apps rely on live generation.
- **Free-tier generation is thin:** Gemini Flash-Lite without Google Search opens 1–3 pages and labels most claims Unverified. Use a Claude key or a paid Gemini key with Search for better-sourced drafts.
- **Generated guides aren't reviewed by a person** and can be wrong. They're always marked *Live draft*.
- **Drafts and chats are per browser.** Share links work anywhere, but there's no shared library of generated guides.
- **Aircall's waiting times come from one real integration** (Aug–Oct 2026) plus Aircall's stated windows.
- **No automatic re-check of provider docs.** Reviewed guides show the date they were last checked by hand.

## Project map

- `data/guides/*.json`: reviewed guides. Register new ones in `src/lib/guides.ts`.
- `data/catalog.json`: the app list (`domain` drives logos).
- `src/app/api/generate`: live research and guide generation (NDJSON stream; payload `{guide, logo, research}`).
- `src/app/api/agent`: the agent chat.
- `src/app/api/key-check`: validates a key.
- `src/lib/research.ts`: Anthropic (web search + fetch) and Gemini (URL context, optional Search) research loops.
- `src/lib/logos.ts`: the logo waterfall.
- `src/components/`: UI, built only from shadcn/ui components.

Stack: Next.js 16 (App Router, Cache Components), Tailwind v4, shadcn/ui, `@anthropic-ai/sdk`, `@google/genai`.
