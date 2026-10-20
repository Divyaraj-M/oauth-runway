-- OAuth Runway schema. Users live in neon_auth."user" (managed by Neon Auth); we store their id (uuid)
-- without a foreign key because Neon manages that schema. Apply with: node --env-file=.env scripts/migrate.mjs

-- Every generated guide. `id` is the share-link id (/g/<id>); `slug` is the normalized app name.
create table if not exists guides (
  id text primary key,
  slug text not null,
  app text not null,
  difficulty text not null,
  payload jsonb not null,
  query text not null,
  model text not null,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists guides_slug_created on guides (slug, created_at desc);
create index if not exists guides_user_created on guides (user_id, created_at desc);

-- One agent conversation per user per guide. guide_key = reviewed guide key, or "g:<guide id>".
create table if not exists chats (
  user_id uuid not null,
  guide_key text not null,
  messages jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (user_id, guide_key)
);

-- Usage log for the admin page: generate | ask | key_check, with outcome and duration.
create table if not exists events (
  id bigserial primary key,
  user_id uuid,
  kind text not null,
  app text,
  ok boolean not null,
  ms integer,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists events_created on events (created_at desc);

-- Each user's AI provider settings. The key is encrypted (src/lib/secret-box.ts); only the last 4 chars are kept
-- in clear so the UI can show "ending in ••••abcd". Never returned to the browser.
create table if not exists user_settings (
  user_id uuid primary key,
  provider text not null,
  model text,
  search boolean not null default false,
  key_sealed text not null,
  key_last4 text not null,
  updated_at timestamptz not null default now()
);
