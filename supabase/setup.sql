-- Tiffo: cloud storage for each signed-in user's books.
-- Run this once in Supabase: SQL Editor → New query → paste → Run.

create table if not exists public.tiffo_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: every user can only see and change their OWN row.
alter table public.tiffo_data enable row level security;

drop policy if exists "Read own Tiffo data"   on public.tiffo_data;
drop policy if exists "Insert own Tiffo data" on public.tiffo_data;
drop policy if exists "Update own Tiffo data" on public.tiffo_data;
drop policy if exists "Delete own Tiffo data" on public.tiffo_data;

create policy "Read own Tiffo data"   on public.tiffo_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own Tiffo data" on public.tiffo_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own Tiffo data" on public.tiffo_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own Tiffo data" on public.tiffo_data for delete to authenticated using ((select auth.uid()) = user_id);
