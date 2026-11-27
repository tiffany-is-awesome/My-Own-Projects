-- Tiffo household sharing (applied to the Supabase project as migration "tiffo_household_sharing").
-- Members see ONLY items someone chose to share, plus each other's display names.
-- Test it with supabase/household-rls-test.sql (all 20 checks passed on 2026-11-27).
create schema if not exists tiffo_private;

create table public.tiffo_households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  owner uuid not null references auth.users(id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.tiffo_household_members (
  household_id uuid not null references public.tiffo_households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role text not null default 'member' check (role in ('owner', 'member')),
  can_share boolean not null default true,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index tiffo_household_members_user_idx on public.tiffo_household_members (user_id);

create table public.tiffo_household_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.tiffo_households(id) on delete cascade,
  author uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('split', 'settle', 'goal', 'contribution')),
  data jsonb not null check (pg_column_size(data) < 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tiffo_household_items_hh_idx on public.tiffo_household_items (household_id, created_at desc);
create index tiffo_household_items_author_idx on public.tiffo_household_items (author);

create or replace function tiffo_private.is_member(hh uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tiffo_household_members m where m.household_id = hh and m.user_id = (select auth.uid()));
$$;
create or replace function tiffo_private.is_owner(hh uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tiffo_households h where h.id = hh and h.owner = (select auth.uid()));
$$;
create or replace function tiffo_private.can_share(hh uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tiffo_household_members m where m.household_id = hh and m.user_id = (select auth.uid()) and m.can_share);
$$;
revoke all on schema tiffo_private from public, anon;
grant usage on schema tiffo_private to authenticated;
revoke all on all functions in schema tiffo_private from public, anon;
grant execute on all functions in schema tiffo_private to authenticated;

alter table public.tiffo_households enable row level security;
alter table public.tiffo_household_members enable row level security;
alter table public.tiffo_household_items enable row level security;

create policy "members read household" on public.tiffo_households for select to authenticated using (tiffo_private.is_member(id));
create policy "owner updates household" on public.tiffo_households for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "owner deletes household" on public.tiffo_households for delete to authenticated using (owner = (select auth.uid()));

create policy "members read members" on public.tiffo_household_members for select to authenticated using (tiffo_private.is_member(household_id));
create policy "owner updates members" on public.tiffo_household_members for update to authenticated using (tiffo_private.is_owner(household_id)) with check (tiffo_private.is_owner(household_id));
create policy "leave or owner removes" on public.tiffo_household_members for delete to authenticated
  using ((user_id = (select auth.uid()) and role <> 'owner') or (tiffo_private.is_owner(household_id) and user_id <> (select auth.uid())));

create policy "members read items" on public.tiffo_household_items for select to authenticated using (tiffo_private.is_member(household_id));
create policy "members add own items" on public.tiffo_household_items for insert to authenticated with check (author = (select auth.uid()) and tiffo_private.can_share(household_id));
create policy "authors edit items" on public.tiffo_household_items for update to authenticated using (author = (select auth.uid())) with check (author = (select auth.uid()) and tiffo_private.is_member(household_id));
create policy "authors or owner delete items" on public.tiffo_household_items for delete to authenticated using (author = (select auth.uid()) or tiffo_private.is_owner(household_id));

revoke all on public.tiffo_households, public.tiffo_household_members, public.tiffo_household_items from anon;
grant select, update, delete on public.tiffo_households to authenticated;
grant select, update, delete on public.tiffo_household_members to authenticated;
grant select, insert, update, delete on public.tiffo_household_items to authenticated;

create or replace function public.tiffo_create_household(p_name text, p_display text) returns json
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); hh uuid; code text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  if (select count(*) from public.tiffo_households where owner = uid) >= 3 then raise exception 'You can own up to 3 households'; end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into public.tiffo_households (name, owner, invite_code) values (left(trim(p_name), 60), uid, code) returning id into hh;
  insert into public.tiffo_household_members (household_id, user_id, display_name, role) values (hh, uid, left(trim(p_display), 40), 'owner');
  return json_build_object('id', hh, 'invite_code', code);
end $$;

create or replace function public.tiffo_join_household(p_code text, p_display text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); hh uuid;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select id into hh from public.tiffo_households where invite_code = upper(trim(p_code));
  if hh is null then raise exception 'That invite code doesn''t match any household'; end if;
  if (select count(*) from public.tiffo_household_members where household_id = hh) >= 12 then raise exception 'This household is full (12 people)'; end if;
  insert into public.tiffo_household_members (household_id, user_id, display_name) values (hh, uid, left(trim(p_display), 40))
  on conflict (household_id, user_id) do nothing;
  return hh;
end $$;

create or replace function public.tiffo_new_invite_code(p_household uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare code text;
begin
  if not exists (select 1 from public.tiffo_households where id = p_household and owner = (select auth.uid())) then raise exception 'Only the owner can do this'; end if;
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  update public.tiffo_households set invite_code = code where id = p_household;
  return code;
end $$;

revoke all on function public.tiffo_create_household(text, text), public.tiffo_join_household(text, text), public.tiffo_new_invite_code(uuid) from public, anon;
grant execute on function public.tiffo_create_household(text, text), public.tiffo_join_household(text, text), public.tiffo_new_invite_code(uuid) to authenticated;
