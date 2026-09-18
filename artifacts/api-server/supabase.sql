-- ============================================================================
-- 300K Edits Wall — Supabase schema
-- Run this in the Supabase SQL editor (hbbeythsjleflruinohv).
-- The api-server writes with the service_role key (RLS bypassed); the public
-- reads happen through the api-server too, so client-side policies only grant
-- access to approved rows in case you ever query directly from the browser.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.wall_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  caption text not null default '',
  kind text not null check (kind in ('upload', 'link')),
  media_type text not null check (media_type in ('image', 'video', 'link')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  provider integer,
  bucket text,
  media_key text,
  poster_key text,
  link_url text,
  size_bytes bigint not null default 0,
  likes bigint not null default 0,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer text
);

create index if not exists wall_submissions_status_idx
  on public.wall_submissions (status, created_at desc);

create index if not exists wall_submissions_id_idx
  on public.wall_submissions (id);

-- Row Level Security: anon/authenticated can only ever read approved rows.
alter table public.wall_submissions enable row level security;

drop policy if exists "wall_submissions_public_read_approved" on public.wall_submissions;
create policy "wall_submissions_public_read_approved"
  on public.wall_submissions
  for select
  using (status = 'approved');

drop policy if exists "wall_submissions_public_insert" on public.wall_submissions;
create policy "wall_submissions_public_insert"
  on public.wall_submissions
  for insert
  with check (status = 'pending');

drop policy if exists "wall_submissions_public_update_status" on public.wall_submissions;
create policy "wall_submissions_public_update_status"
  on public.wall_submissions
  for update
  using (true)
  with check (true);

-- Nothing else is exposed; the service role drives all writes/reads server-side.