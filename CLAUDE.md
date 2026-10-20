# OAuth Runway

Take-home for the APM Integrations role at Composio. Budget: 6–8 hours total; about half is used.

## The problem
A developer building an AI agent needs their own OAuth app with each provider (Gmail, Slack, Aircall…) before launch. They can't tell upfront if approval takes an hour or two months, what blocks it, or what to start first. Provider docs and Composio's own auth guides (composio.dev/auth) explain the clicks, not the time, gates or cost.

## What we're building
A website where a developer:
1. Looks up an app, or describes one in one sentence, and gets a guide.
2. Sees difficulty (Level 1–4), work time vs waiting time (best / normal / worst), what to start now, how their case changes the path, blockers, and who does each step (Agent / You / Provider).
3. Can ask an agent questions about any step while setting up.
4. Can share the guide (link or Markdown).

Guides explain AND move the developer forward: the agent should produce things (plan docs, scope lists, justification text), not only describe steps.

## Difficulty levels
1. Self-serve: credentials in minutes, no review for the common case
2. Review to list: works now, review only for a public listing
3. Security audit: verification plus a paid third-party assessment for some permissions
4. Partner-gated: a person at the provider must approve and create the app

## Rules (non-negotiable)
- Every claim carries an evidence label: Tested (done first-hand), Sourced (links a page actually read), Unverified. A generated guide can never be Tested.
- No credentials in the repo, the guides, or the chat. The chat and search box block key-like input (client and server).
- AI keys are bring-your-own, saved per user in `user_settings`, encrypted with AES-256-GCM (`src/lib/secret-box.ts`, `KEY_ENCRYPTION_SECRET`). Encrypt, don't hash: the server needs the real key. Decrypt only in `credentialsFor(userId)` for the request; never return or log the key (the UI gets `last4`). Nothing is kept in localStorage; an old browser key is migrated once and wiped. There is no server-wide AI key. Only `LOGO_DEV_TOKEN` (publishable `pk_`) lives in `.env`; ship `.env.example`.
- Never invent precise review durations. Use ranges and list unknowns.
- Brand logos: from SVGL, BrandBird and Logo.dev (see Current state), used under each brand's terms with attribution in the footer. The letter tile is always the last fallback.

## Current state
- Next.js 16 (App Router, Turbopack, Cache Components) + Tailwind v4 + shadcn/ui (radix-nova, zinc tokens carried over from the prototype). Next 16 has breaking changes: read `node_modules/next/dist/docs/` before touching framework APIs (see AGENTS.md).
- Routes: `/` library + live generation, `/guides/[key]` (static, from `data/guides/*.json`), `/g/[id]` (generated guides from Neon; the share link), `/admin` (ADMIN_EMAILS). Sign-in is a modal (`SignInDialog`, email OTP only; passwords and Google are disabled in Neon Auth); `useMe().requireSignIn()` opens it and resolves when signed in. `/draft` is legacy (browser-saved drafts and `#share=` links). A reviewed guide always wins over a draft in the library.
- Data: Neon Postgres (`db/schema.sql`: guides, chats, events; users in `neon_auth."user"`). Neon project `morning-cake-54391842`, us-east-1. Generating and asking require sign-in; reading is public. After saving a guide the client calls the `refreshLibrary` server action (`updateTag`), because `revalidateTag` from inside the streaming response didn't take effect. Anything reading the session must call `currentUser()` (it calls `connection()` so builds never prerender a signed-out result).. Old `/#gmail` links redirect.
- Guide data: `data/guides/<key>.json` (register new files in `src/lib/guides.ts`), app list in `data/catalog.json`.
- Agent: `POST /api/generate` (`{query}`) and `POST /api/agent` (`{guide, messages}`) use the user's own key from Settings (`src/lib/ai-settings.ts`, `src/components/settings/`): Anthropic = Claude Opus 5.5 with server-side web search + web fetch; Gemini = 3.8 Flash / 3.5 Flash-Lite with URL context (free tier, model picks pages to open first) plus Google Search when the paid-tier toggle is on (`src/lib/research.ts`). `POST /api/key-check` validates a key with a free listing call. Both stream NDJSON: `search` / `fetch` / `text` events, then `done` or `error`. Generate's `done.payload` is `{guide, logo, research}`.
- Evidence is enforced server-side in the generate route: "sourced" survives only if the claim's `src` is a page the model actually opened (web_fetch); sources not opened are dropped; "tested" is never allowed.
- Logos: server-side waterfall in `src/lib/logos.ts` (bundled SVGL → SVGL API → BrandBird file probe → Logo.dev by `domain` if `LOGO_DEV_TOKEN` is set → letter tile), cached for a day. New catalog entries in `data/catalog.json` (with `domain`) pick up logos with no code change.
- `prototype/index.html` is the v3 single-file prototype, kept for reference only (it relied on `window.claude.use`, which only exists in claude.ai artifacts).
- Spec doc (requirements, metrics, open questions) lives in claude.ai as "OAuth Runway — Feature Spec".

## Evidence we have
- Aircall: first-hand integration (Aug 31 – Oct 19 2026). ~7 weeks from partner acceptance to production credentials for ~3 days of work. Plan doc gates the dev account; no localhost redirects; follow-up emails reset your queue position; account status changes silently. Names and contact details must stay out of the repo.
- Gmail: Composio's default Gmail auth config pre-selects `https://mail.google.com/` (restricted scope → CASA security assessment). Observed in the dashboard.
- Slack Marketplace review up to ~12 weeks (third-party summary). Notion: sources disagree on whether public integrations get a security review.

## Next (in order)
1. ~~Move to Next.js + real shadcn components; guide data as JSON in `data/guides/`.~~ Done.
2. ~~API routes with web search.~~ Built; not yet run against the live API (needs a key in `.env`).
3. ~~Verification pass → `VERIFICATION.md`.~~ Done (Gmail, Slack, Aircall, Notion + 3 live generations).
4. ~~README: setup, key decisions, limitations.~~ Done.
5. ~~Deploy (Vercel)~~ Live at https://oauth-runway-blush.vercel.app (repo github.com/Divyaraj-M/oauth-runway). Deploy with `vercel deploy --prod`; env vars are set in Vercel.
