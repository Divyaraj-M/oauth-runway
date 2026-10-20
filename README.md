# OAuth Runway

**How long until your OAuth app is approved?** Look up an app, or describe one, and get a guide to creating its OAuth app and getting it approved: how hard it is, your work time vs. the provider's waiting time, what blocks approval, what to start now, and who does each step (Agent / You / Provider). For an app that isn't in the library, an agent researches it live and writes a guide you can keep and share.

## The problem it solves

Before an AI agent can act in a user's Gmail, Slack or Aircall, the developer often needs their own OAuth app with that provider. Provider docs and Composio's auth guides explain *the clicks*. They rarely say *how long*: whether it's an hour of self-serve setup or two months of partner review, which scope pulls you into a paid security audit, or which email resets your place in a queue. OAuth Runway answers those questions first.

**Live:** https://oauth-runway-blush.vercel.app · **Source:** https://github.com/Divyaraj-M/oauth-runway

## Setup

```bash
npm install
cp .env.example .env
```

Database and sign-in run on **Neon** (Postgres + Neon Auth). With the `neon` CLI (`npx neonctl auth` to log in):

```bash
npx neonctl projects create --name oauth-runway --region-id aws-us-east-1
npx neonctl neon-auth enable --project-id <project> --branch main --database-name neondb
npx neonctl connection-string main --project-id <project> --pooled   # → DATABASE_URL
# Passwordless only: turn off passwords and the shared Google provider
npx neonctl neon-auth config email-password update --enabled false --project-id <project> --branch main
npx neonctl neon-auth oauth-provider delete --provider-id google --project-id <project> --branch main
npx neonctl neon-auth domain add https://<your-domain> --project-id <project> --branch main
```

Put `DATABASE_URL`, `NEON_AUTH_BASE_URL` (the `base_url` printed by `neon-auth enable`), `NEON_AUTH_COOKIE_SECRET` (`openssl rand -base64 32`) and `ADMIN_EMAILS` (your email, for `/admin`) in `.env`. Then:

```bash
node --env-file=.env scripts/migrate.mjs   # creates guides, chats, events
npm run dev                                # http://localhost:3000
```

Optional: `LOGO_DEV_TOKEN` (publishable `pk_…`) for more logos, `CLOUDINARY_URL` to mirror logos into Cloudinary.

**Sign in** with your email and the 6-digit code it sends you (no password; the first sign-in creates the account), then click **Add AI key** (top right) and paste your own key:

- **Google Gemini (free):** create a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) **in a project with no billing linked**. A billed project with depleted prepay credits is refused ("prepayment credits are depleted"), even for free models. Leave *Use Google Search* off on the free tier.
- **Anthropic Claude:** a key from console.anthropic.com with API credits. Uses Claude Opus 5.5 with web search and web fetch, which gives the best-sourced guides.

**Test key** checks it with a free call. The key is stored only in your browser.

## What's in it

- **Library:** 4 hand-reviewed guides chosen to cover all four difficulty levels, plus 16 more catalog apps the agent can research.
  - Notion: L1 Self-serve
  - Slack: L2 Review to list
  - Gmail: L3 Security audit
  - Aircall: L4 Partner-gated
- **Live generation (signed in):** type an app name or website and what your agent should do. The agent researches it and streams progress (pages it opens). The guide is saved to the **shared library** as a **Draft** and gets its own page, `/g/<id>`, which is its share link.
- **Guide page:**
  - Difficulty and timeline at a glance.
  - *Start now* (the one action that shortens the wait).
  - Tabs: *Your case* (how your situation changes the path), *Steps*, *Blockers*, *Who does what*, *Sources*.
- **Agent chat (signed in):** ask about any step; it can draft the plan doc, scope list or reviewer email. Chats are saved to your account per guide.
- **Share:** every guide has a link anyone can open without signing in (`/guides/<app>` for reviewed, `/g/<id>` for generated), plus Copy as Markdown.
- **Admin (`/admin`, `ADMIN_EMAILS` only):** users, every generated guide, and every generation, question and key check with its outcome, duration and error.

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
7. **One shared library, attributed.** Generated guides, chats and a usage log live in Neon Postgres (`db/schema.sql`). Reading is open to everyone; generating and asking need sign-in (Neon Auth, passwordless email codes in a modal that resumes what you were doing), so every run has an owner and shows on `/admin`. Generated guides are immutable and cached; the library refreshes the moment a guide is saved.
8. **Logos by waterfall:** bundled SVGL → SVGL API → BrandBird → Logo.dev → letter tile, resolved on the server and cached for a day. SVGL and BrandBird logos are mirrored into Cloudinary when configured (Logo.dev images are loaded from Logo.dev, as its terms expect). A new catalog entry with a `domain` gets a logo with no code change.

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
- **Sign-in is email code only** (a modal, no passwords or social sign-in). Codes are sent from Neon's shared mail sender (`auth@mail.myneon.app`), which has low limits and can land in spam; a custom SMTP provider fixes that. Sign-in works on the production URL and localhost, not on Vercel preview URLs.
- **Generated guides can't be edited or deleted from the UI** yet; an admin can remove rows in the database.
- **Aircall's waiting times come from one real integration** (Aug–Oct 2026) plus Aircall's stated windows.
- **`/guides/<unknown>` and `/g/<unknown>` show the not-found page with HTTP 200** (the page streams before the lookup finishes).
- **No automatic re-check of provider docs.** Reviewed guides show the date they were last checked by hand.

## Project map

- `data/guides/*.json`: reviewed guides. Register new ones in `src/lib/guides.ts`.
- `data/catalog.json`: the app list (`domain` drives logos).
- `src/app/api/generate`: live research and guide generation (NDJSON stream; payload `{guide, logo, research}`).
- `src/app/api/agent`: the agent chat.
- `src/app/api/key-check`: validates a key.
- `src/app/g/[id]`: a saved generated guide. `src/app/admin`: usage dashboard. `src/components/auth/sign-in-dialog.tsx`: the email-code sign-in modal.
- `src/lib/db.ts` + `db/schema.sql`: Neon queries and schema. `src/lib/auth/`: Neon Auth. `src/lib/cloudinary.ts`: logo mirroring.
- `src/lib/research.ts`: Anthropic (web search + fetch) and Gemini (URL context, optional Search) research loops.
- `src/lib/logos.ts`: the logo waterfall.
- `src/components/`: UI, built only from shadcn/ui components.

Stack: Next.js 16 (App Router, Cache Components), Tailwind v4, shadcn/ui, Neon Postgres + Neon Auth, Cloudinary, `@anthropic-ai/sdk`, `@google/genai`, deployed on Vercel.
