-- Paste into the Supabase SQL Editor of the project you choose. Safe to run in a shared project:
-- one namespaced table, RLS on with no policies, so only the server (secret key) can read or write.
create table if not exists public.oauth_guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  query text not null,               -- what the developer typed (app name or URL)
  guide jsonb not null,              -- a Guide, validated against lib/guide/schema.ts before insert
  trace jsonb not null default '[]', -- the agent's searches and fetches, shown as "how this was researched"
  usage jsonb,                       -- tokens and searches, for cost tracking
  model text not null,
  created_at timestamptz not null default now()
);

create index if not exists oauth_guides_slug_created_idx on public.oauth_guides (slug, created_at desc);

alter table public.oauth_guides enable row level security;
-- Deliberately no policies: the publishable/anon key gets nothing.
