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
- `index.html`: working single-file prototype (v3). shadcn/ui zinc tokens + Geist, recreated with Tailwind play CDN. Library of 4 reviewed guides (Gmail L3, Aircall L4, Slack L2, Notion L1) + 16 unrated apps, live guide generation, agent chat sheet, motion with reduced-motion fallback.
- The live agent uses `window.claude.use("sample")`, which only exists inside claude.ai artifacts. **It will not work when run locally.** Replace it first (see Next).
- The agent has no web search yet. Its "research" is reading the guide JSON.
- Spec doc (requirements, metrics, open questions) lives in claude.ai as "OAuth Runway — Feature Spec".

## Evidence we have
- Aircall: first-hand integration (Aug 31 – Oct 19 2026). ~7 weeks from partner acceptance to production credentials for ~3 days of work. Plan doc gates the dev account; no localhost redirects; follow-up emails reset your queue position; account status changes silently. Names and contact details must stay out of the repo.
- Gmail: Composio's default Gmail auth config pre-selects `https://mail.google.com/` (restricted scope → CASA security assessment). Observed in the dashboard.
- Slack Marketplace review up to ~12 weeks (third-party summary). Notion: sources disagree on whether public integrations get a security review.

## Next (in order)
1. Move to Next.js + real shadcn components (`npx shadcn add card badge tabs sheet dialog alert table progress skeleton input textarea`). Port `index.html` page by page; keep the guide data as JSON in `data/guides/`.
2. Add an API route for the agent that calls the Anthropic API with a web search tool, so Sourced claims cite pages actually opened. Key from `ANTHROPIC_API_KEY` in `.env`.
3. Verification pass on Gmail, Aircall, Slack: record what was tested, sourced, corrected, unconfirmed → `VERIFICATION.md`.
4. README: setup, key decisions, limitations.
5. Deploy (Vercel) and test live generation on 3 unseen apps.
