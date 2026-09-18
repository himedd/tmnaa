-- ============================================================================
-- 300K Edits Wall — Admin credentials
-- Stores ONLY the admin password (scrypt-hashed) in the database.
-- Paste into the Supabase SQL editor and Run.
-- ============================================================================

create table if not exists public.admin_credentials (
  id integer primary key,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Seed row: hash format "s:<N>:<r>:<p>:<saltB64>:<hashB64>"
-- This is a real scrypt hash for the admin password chosen at setup time.
insert into public.admin_credentials (id, password_hash)
values (1, 's:16384:8:1:TAdjYRDTz3HCA9LvRzMd6A==:5Dmkhtk153vBMYg8dmHnjf2NNwvdJmEYF1Vt+HwZPrY=')
on conflict (id) do update set password_hash = excluded.password_hash;

-- No RLS policies: the admin table is only ever read by the api-server with
-- the service_role key (RLS bypassed). Lock it down completely.
alter table public.admin_credentials disable row level security;

revoke all on public.admin_credentials from anon, authenticated;