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
- No credentials anywhere: not in the repo, the guides, or the chat. The chat and search box block key-like input. API keys live in `.env`, never committed; ship `.env.example`.
- Never invent precise review durations. Use ranges and list unknowns.
- Brand logos: the current page uses letter tiles. If adding logos, the developer adds the SVG files themselves (e.g. from svgl.app) under each brand's terms; keep the letter tile as fallback.

## Current state
- Next.js 16 (App Router, Turbopack, Cache Components) + Tailwind v4 + shadcn/ui (radix-nova, zinc tokens carried over from the prototype). Next 16 has breaking changes: read `node_modules/next/dist/docs/` before touching framework APIs (see AGENTS.md).
- Routes: `/` library + live generation, `/guides/[key]` (static, from `data/guides/*.json`), `/draft` (live draft kept in sessionStorage only). Old `/#gmail` links redirect.
- Guide data: `data/guides/<key>.json` (register new files in `src/lib/guides.ts`), app list in `data/catalog.json`.
- Agent seam: `src/lib/agent-client.ts` streams plain text from `POST /api/agent` (`{guide, messages}`) and `POST /api/generate` (`{query}`, returns guide JSON). **Neither route exists yet**; the UI shows "agent isn't connected" until step 2.
- The agent has no web search yet.
- `prototype/index.html` is the v3 single-file prototype, kept for reference only (it relied on `window.claude.use`, which only exists in claude.ai artifacts).
- Spec doc (requirements, metrics, open questions) lives in claude.ai as "OAuth Runway — Feature Spec".

## Evidence we have
- Aircall: first-hand integration (Aug 31 – Oct 19 2026). ~7 weeks from partner acceptance to production credentials for ~3 days of work. Plan doc gates the dev account; no localhost redirects; follow-up emails reset your queue position; account status changes silently. Names and contact details must stay out of the repo.
- Gmail: Composio's default Gmail auth config pre-selects `https://mail.google.com/` (restricted scope → CASA security assessment). Observed in the dashboard.
- Slack Marketplace review up to ~12 weeks (third-party summary). Notion: sources disagree on whether public integrations get a security review.

## Next (in order)
1. ~~Move to Next.js + real shadcn components; guide data as JSON in `data/guides/`.~~ Done.
2. Add an API route for the agent that calls the Anthropic API with a web search tool, so Sourced claims cite pages actually opened. Key from `ANTHROPIC_API_KEY` in `.env`.
3. Verification pass on Gmail, Aircall, Slack: record what was tested, sourced, corrected, unconfirmed → `VERIFICATION.md`.
4. README: setup, key decisions, limitations.
5. Deploy (Vercel) and test live generation on 3 unseen apps.
