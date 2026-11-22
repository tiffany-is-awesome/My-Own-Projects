-- Unique Ava: cloud storage for each signed-in user's closet, looks and lookbooks.
-- Run this once in Supabase: SQL Editor → New query → paste → Run.
-- (Same project as Tiffo: accounts are shared, data is kept in its own table.)

create table if not exists public.unique_ava_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on table public.unique_ava_data to authenticated;

-- Row Level Security: every user can only see and change their OWN closet.
alter table public.unique_ava_data enable row level security;

drop policy if exists "Read own Unique Ava data"   on public.unique_ava_data;
drop policy if exists "Insert own Unique Ava data" on public.unique_ava_data;
drop policy if exists "Update own Unique Ava data" on public.unique_ava_data;
drop policy if exists "Delete own Unique Ava data" on public.unique_ava_data;

create policy "Read own Unique Ava data"   on public.unique_ava_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own Unique Ava data" on public.unique_ava_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own Unique Ava data" on public.unique_ava_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own Unique Ava data" on public.unique_ava_data for delete to authenticated using ((select auth.uid()) = user_id);
