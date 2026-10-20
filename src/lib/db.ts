import { neon } from "@neondatabase/serverless";
import { cacheLife, cacheTag } from "next/cache";

import type { GeneratePayload, LogoInfo } from "./types";

/** Neon over HTTP (one query per request, no pool to manage). Schema: db/schema.sql. */
let client: ReturnType<typeof neon> | null = null;
const sql = () => (client ??= neon(process.env.DATABASE_URL!));

export const GUIDES_TAG = "guides";

/** draft (author only) → published (public, pending approval) → approved (by an admin). */
export type GuideStatus = "draft" | "published" | "approved";
export type Review = { status: GuideStatus; ownerId: string | null; approvedBy: string | null; approvedAt: string | null };

/** URL-safe share id, e.g. "k3Vt9QxA2m". */
export function newGuideId() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => abc[b % abc.length]).join("");
}

export async function insertGuide(row: { id: string; slug: string; query: string; userId: string; payload: GeneratePayload }) {
  const { guide, research } = row.payload;
  await sql()`insert into guides (id, slug, app, difficulty, payload, query, model, user_id)
    values (${row.id}, ${row.slug}, ${guide.app}, ${guide.difficulty}, ${JSON.stringify(row.payload)}::jsonb, ${row.query}, ${research.model}, ${row.userId})`;
}

/** One generated guide. Guides never change after insert, so cache for as long as possible. */
export async function getGuide(id: string): Promise<(GeneratePayload & { createdAt: string; author: string | null; review: Review }) | null> {
  "use cache";
  cacheLife("max");
  cacheTag(`guide-${id}`);
  const rows = (await sql()`select g.payload, g.created_at, g.status, g.user_id, g.approved_at, u.name as author,
      nullif(a.name, '') as approver
    from guides g left join neon_auth."user" u on u.id = g.user_id left join neon_auth."user" a on a.id = g.approved_by
    where g.id = ${id}`) as Record<string, unknown>[];
  const r = rows[0];
  if (!r) return null;
  return {
    ...(r.payload as GeneratePayload),
    createdAt: new Date(r.created_at as string).toISOString(),
    author: (r.author as string) ?? null,
    review: {
      status: r.status as GuideStatus,
      ownerId: (r.user_id as string) ?? null,
      approvedBy: (r.approver as string) ?? null,
      approvedAt: r.approved_at ? new Date(r.approved_at as string).toISOString() : null,
    },
  };
}

/* The approver's name is public on approved guides, so only their display name is used, never their email. */

/** Moves a guide through the review flow. Returns false when the guide isn't in the expected state (or isn't the caller's). */
export async function setGuideStatus(
  id: string,
  change: { to: "published"; ownerId: string } | { to: "approved"; adminId: string } | { to: "draft"; adminId: string },
) {
  const rows =
    change.to === "published"
      ? await sql()`update guides set status = 'published', published_at = now() where id = ${id} and user_id = ${change.ownerId} and status = 'draft' returning id`
      : change.to === "approved"
        ? await sql()`update guides set status = 'approved', approved_at = now(), approved_by = ${change.adminId} where id = ${id} and status = 'published' returning id`
        : await sql()`update guides set status = 'draft', published_at = null, approved_at = null, approved_by = null where id = ${id} and status in ('published', 'approved') returning id`;
  return (rows as unknown[]).length > 0;
}

export type DraftSummary = {
  id: string;
  slug: string;
  app: string;
  difficulty: string;
  verdict: string;
  work: string;
  wait: string;
  logo: LogoInfo | null;
  status: GuideStatus;
  createdAt: string;
};

const summaryCols = (rows: Record<string, unknown>[]): DraftSummary[] =>
  rows.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    app: r.app as string,
    difficulty: r.difficulty as string,
    verdict: (r.verdict as string) ?? "",
    work: (r.work as string) ?? "Unknown",
    wait: (r.wait as string) ?? "Unknown",
    logo: (r.logo as LogoInfo) ?? null,
    status: (r.status as GuideStatus) ?? "draft",
    createdAt: new Date(r.created_at as string).toISOString(),
  }));

/** The newest generated guide per app, for the shared library. Refreshed when a guide is saved. */
export async function latestDrafts(): Promise<DraftSummary[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(GUIDES_TAG);
  if (!process.env.DATABASE_URL) return [];
  // Drafts are private, so the library shows published guides only; an approved one beats a newer pending one.
  const rows = (await sql()`select distinct on (slug) id, slug, app, difficulty, status, created_at,
      payload->'guide'->>'verdict' as verdict, payload->'guide'->'hands_on'->>'text' as work,
      payload->'guide'->'waiting'->>'normal' as wait, payload->'logo' as logo
    from guides where status in ('published', 'approved')
    order by slug, (status = 'approved') desc, created_at desc limit 300`) as Record<string, unknown>[];
  return summaryCols(rows);
}

/** A user's own guides, newest first (not cached: per user). */
export async function userGuides(userId: string, limit = 6): Promise<DraftSummary[]> {
  const rows = (await sql()`select id, slug, app, difficulty, status, created_at,
      payload->'guide'->>'verdict' as verdict, payload->'guide'->'hands_on'->>'text' as work,
      payload->'guide'->'waiting'->>'normal' as wait, payload->'logo' as logo
    from guides where user_id = ${userId} order by created_at desc limit ${limit}`) as Record<string, unknown>[];
  return summaryCols(rows);
}

/** Usage log; never throws (logging must not break a request). */
export async function logEvent(e: { userId: string | null; kind: "generate" | "ask" | "key_check" | "publish" | "approve" | "send_back"; app?: string; ok: boolean; ms?: number; detail?: unknown }) {
  try {
    await sql()`insert into events (user_id, kind, app, ok, ms, detail)
      values (${e.userId}, ${e.kind}, ${e.app ?? null}, ${e.ok}, ${e.ms ?? null}, ${e.detail === undefined ? null : JSON.stringify(e.detail)}::jsonb)`;
  } catch (err) {
    console.error("logEvent failed", err instanceof Error ? err.message : err);
  }
}

export type ChatRow = { role: "user" | "assistant"; content: string; error?: boolean; trace?: string[]; at: string };

export async function getChat(userId: string, key: string): Promise<ChatRow[]> {
  const rows = (await sql()`select messages from chats where user_id = ${userId} and guide_key = ${key}`) as { messages: ChatRow[] }[];
  return rows[0]?.messages ?? [];
}

/** Appends turns to a conversation, keeping the last 60 messages. */
export async function appendChat(userId: string, key: string, add: ChatRow[]) {
  await sql()`insert into chats (user_id, guide_key, messages) values (${userId}, ${key}, ${JSON.stringify(add)}::jsonb)
    on conflict (user_id, guide_key) do update set
      messages = (select coalesce(jsonb_agg(m order by n), '[]'::jsonb) from (
        select m, n from jsonb_array_elements(chats.messages || excluded.messages) with ordinality as t(m, n)
        order by n desc limit 60) last),
      updated_at = now()`;
}

export async function clearChat(userId: string, key: string) {
  await sql()`delete from chats where user_id = ${userId} and guide_key = ${key}`;
}

/* ---------- admin ---------- */

export async function adminOverview() {
  const [counts] = (await sql()`select
      (select count(*) from neon_auth."user")::int as users,
      (select count(*) from guides)::int as guides,
      (select count(*) from events where kind = 'generate' and created_at > now() - interval '24 hours')::int as generations_24h,
      (select count(*) from events where not ok and created_at > now() - interval '24 hours')::int as failures_24h,
      (select count(*) from events where kind = 'ask')::int as questions`) as Record<string, number>[];
  const events = (await sql()`select e.created_at, e.kind, e.app, e.ok, e.ms, e.detail, u.email
    from events e left join neon_auth."user" u on u.id = e.user_id order by e.created_at desc limit 100`) as Record<string, unknown>[];
  const guides = (await sql()`select g.id, g.app, g.difficulty, g.model, g.status, g.created_at, u.email
    from guides g left join neon_auth."user" u on u.id = g.user_id order by g.created_at desc limit 100`) as Record<string, unknown>[];
  const pending = (await sql()`select g.id, g.app, g.difficulty, g.published_at, u.email
    from guides g left join neon_auth."user" u on u.id = g.user_id where g.status = 'published' order by g.published_at asc limit 100`) as Record<string, unknown>[];
  const users = (await sql()`select u.email, u.name, u."createdAt" as created_at,
      (select count(*) from guides g where g.user_id = u.id)::int as guides,
      (select max(created_at) from events e where e.user_id = u.id) as last_seen
    from neon_auth."user" u order by u."createdAt" desc limit 100`) as Record<string, unknown>[];
  return { counts, events, guides, users, pending };
}

/* ---------- AI provider settings (key encrypted; see secret-box.ts) ---------- */

export type AiSettingsSummary = { provider: "anthropic" | "gemini"; model: string | null; search: boolean; last4: string } | null;

/** What the browser may see: provider, model, and the key's last 4 characters. Never the key. */
export async function getAiSummary(userId: string): Promise<AiSettingsSummary> {
  const rows = (await sql()`select provider, model, search, key_last4 from user_settings where user_id = ${userId}`) as Record<string, unknown>[];
  const r = rows[0];
  return r ? { provider: r.provider as "anthropic" | "gemini", model: (r.model as string) ?? null, search: !!r.search, last4: r.key_last4 as string } : null;
}

export async function getSealedKey(userId: string) {
  const rows = (await sql()`select provider, model, search, key_sealed from user_settings where user_id = ${userId}`) as Record<string, unknown>[];
  return (rows[0] as { provider: "anthropic" | "gemini"; model: string | null; search: boolean; key_sealed: string } | undefined) ?? null;
}

export async function saveAiSettings(userId: string, s: { provider: string; model: string | null; search: boolean; keySealed?: string; last4?: string }) {
  if (s.keySealed && s.last4) {
    await sql()`insert into user_settings (user_id, provider, model, search, key_sealed, key_last4)
      values (${userId}, ${s.provider}, ${s.model}, ${s.search}, ${s.keySealed}, ${s.last4})
      on conflict (user_id) do update set provider = excluded.provider, model = excluded.model, search = excluded.search,
        key_sealed = excluded.key_sealed, key_last4 = excluded.key_last4, updated_at = now()`;
  } else {
    await sql()`update user_settings set model = ${s.model}, search = ${s.search}, updated_at = now() where user_id = ${userId}`;
  }
}

export async function deleteAiSettings(userId: string) {
  await sql()`delete from user_settings where user_id = ${userId}`;
}
