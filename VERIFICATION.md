# Verification pass

Sample checked: the reviewed guides for Gmail, Slack, Aircall and Notion, plus three live generated guides. Sources were re-read on **Oct 20, 2026**.

Labels follow the app: **Tested** = done first-hand, **Sourced** = on a page actually read, **Unverified** = not confirmed.

## Gmail (Level 3 · Security audit)

| Claim | Result | Source |
|---|---|---|
| `gmail.send` is sensitive; `gmail.readonly`, `.modify`, `.compose`, `.metadata` and `https://mail.google.com/` are restricted | Confirmed | [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes) |
| Restricted scopes need a CASA security assessment, renewed yearly | Confirmed. Google: "All applications must be revalidated every year." Assurance level (AL1/AL2) depends on users and scopes | [Restricted scope verification](https://support.google.com/cloud/answer/13465431) |
| Unverified apps are capped at 100 users | Confirmed and reworded: the cap is on **new** users | [Unverified apps](https://support.google.com/cloud/answer/7454865) |
| Internal (same-Workspace) apps don't need verification | Confirmed | Same page |
| Composio's Gmail auth config pre-selects `https://mail.google.com/` | Tested (seen in the Composio dashboard); not re-checked in this pass | — |
| CASA costs a few hundred to a few thousand dollars a year | Not on Google's pages. Stays a third-party estimate | Nango, Composio write-ups |
| Exact review time for restricted scopes | **Unverified.** Google only says Trust and Safety contacts you when it's time | — |

## Slack (Level 2 · Review to list)

| Claim | Result | Source |
|---|---|---|
| Marketplace: preliminary review up to 10 business days, functional review up to 10 weeks | Confirmed, and now sourced to Slack's own guide (was a third-party summary) | [Marketplace review guide](https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide) |
| Once listed, scopes and config are locked; changes are re-reviewed (up to 6 weeks) | Confirmed | Same page |
| "A returned submission loses its place in the queue" | **Corrected.** True only in the preliminary review; in the functional review, a resubmission keeps its place | Same page |
| Reviewers need a working test account on your product | Confirmed | Same page |
| Some scopes aren't accepted | Confirmed and made specific: legacy and broad scopes (`identity.*`, `admin.*`), scopes for unbuilt features, and coded workflows can't be listed | Same page (added as a blocker) |
| Unlisted public distribution needs HTTPS redirects and no review | **Unverified** (not re-checked) | — |

## Aircall (Level 4 · Partner-gated)

| Claim | Result | Source |
|---|---|---|
| Must be an approved Technology Partner first | Confirmed | [Build & Launch](https://developer.aircall.io/docs/launch-process) |
| Plan doc is reviewed before the dev account is created | Confirmed (also tested) | Same page + first-hand |
| Trial dev account lasts 4 months; you get dev and prod OAuth apps | Confirmed | Same page |
| Public listing only after 10 customers | Confirmed | Same page |
| Complete within 6 months; going quiet is risky | Confirmed and made precise: a plan with no reply is discarded after 1 month; during the build, monthly follow-ups for 2 months, then decommissioning a month later; progress update every 2 months | Same page |
| Launch timelines | **Added:** demo and assets review 1–5 business days, publication 3–5 business days | Same page |
| Follow-up emails reset your queue position; status changes are silent; localhost redirects rejected; 120 req/min | Tested only (one integration, Aug 31 – Oct 19 2026). No public source | First-hand |

## Notion (Level 1 · Self-serve)

| Claim | Result | Source |
|---|---|---|
| Public integrations get OAuth credentials immediately, no review | **Changed.** Notion's docs say the authorization URL "populates after a public connection is submitted for review". The level stays 1 for now, but the verdict and blockers now say so | [Authorization](https://developers.notion.com/docs/authorization) |
| Installation scope (any or selected workspaces) | **Added:** set at creation and can't be changed later | Same page |
| How long the review takes and what it checks | **Unverified.** Not published | — |

## Generated guides (live, Gemini 3.5 Flash-Lite, free tier)

| App | What happened | Learned |
|---|---|---|
| Calendly | Opened 3 pages, L1, 0 Sourced claims | The model cited URLs that redirect. The server now follows redirects before matching citations to opened pages |
| Zoom | Planned 4 Marketplace and help pages, opened 2 (a support article and the developer home); L2; all 8 claims self-labelled Unverified | Flash-Lite plans plausible but non-existent URLs; only opened pages count, so the guide stays honest but thin |
| Linear | First run hung after the full answer arrived | Gemini sometimes never closes the stream. A watchdog now ends it after 15 s of silence and keeps the answer |

Takeaway: the evidence rules hold (nothing generated is ever Tested, and Sourced requires an opened page), but on the free tier with no Google Search, generated guides are mostly Unverified. A Claude key or a paid Gemini key with Search produces better-sourced drafts.
