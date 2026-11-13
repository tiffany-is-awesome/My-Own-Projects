-- Pantry to Plate: cloud storage for each signed-in user's pantry, staples and cookbooks.
-- Run this once in Supabase: SQL Editor → New query → paste → Run.
-- It uses the same Supabase project as Tiffo, in its own separate table.

create table if not exists public.pantry_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Signed-in users may use the table. Row Level Security below limits each person to their OWN row.
-- Guests (anon) get no access.
grant select, insert, update, delete on table public.pantry_data to authenticated;

alter table public.pantry_data enable row level security;

drop policy if exists "Read own pantry"   on public.pantry_data;
drop policy if exists "Insert own pantry" on public.pantry_data;
drop policy if exists "Update own pantry" on public.pantry_data;
drop policy if exists "Delete own pantry" on public.pantry_data;

create policy "Read own pantry"   on public.pantry_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own pantry" on public.pantry_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own pantry" on public.pantry_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own pantry" on public.pantry_data for delete to authenticated using ((select auth.uid()) = user_id);
