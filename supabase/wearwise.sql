-- Wearwise: cloud storage for each signed-in user's closet, outfits, calendar and lookbooks.
-- Run this once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.
-- (Same project as Tiffo: accounts are shared, data is kept in its own table.)
-- Applied to the live project on 2026-11-23.

-- 1) If the old table exists, rename it (keeps any data and its access rules).
do $$ begin
  if to_regclass('public.unique_ava_data') is not null and to_regclass('public.wearwise_data') is null then
    alter table public.unique_ava_data rename to wearwise_data;
  end if;
end $$;

create table if not exists public.wearwise_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) Only what the app needs: signed-in users, their own row. Nothing for anonymous visitors.
revoke all on public.wearwise_data from anon;
revoke all on public.wearwise_data from authenticated;
grant select, insert, update, delete on table public.wearwise_data to authenticated;

-- 3) Row Level Security: every user can only see and change their OWN closet.
alter table public.wearwise_data enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'wearwise_data' loop
    execute format('drop policy %I on public.wearwise_data', p.policyname);
  end loop;
end $$;
create policy "Read own Wearwise data"   on public.wearwise_data for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own Wearwise data" on public.wearwise_data for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own Wearwise data" on public.wearwise_data for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own Wearwise data" on public.wearwise_data for delete to authenticated using ((select auth.uid()) = user_id);

-- 4) One account's data can't grow without limit (photos are stored inside it as compressed images).
alter table public.wearwise_data drop constraint if exists wearwise_data_size;
alter table public.wearwise_data add constraint wearwise_data_size check (octet_length(data::text) < 30000000);

-- 5) The server stamps every save, so a device with a wrong clock can't confuse the "changed on another device" check.
create or replace function public.wearwise_touch() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists wearwise_touch on public.wearwise_data;
create trigger wearwise_touch before insert or update on public.wearwise_data for each row execute function public.wearwise_touch();
