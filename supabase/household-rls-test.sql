-- Tiffo household sharing: safety test.
-- Paste into Supabase SQL Editor and press Run.
-- It ends with an error ON PURPOSE that lists the results; that error undoes everything,
-- so the pretend users and test household are never saved. Every line should start with "true".
do $$
declare
  a uuid := '11111111-1111-4111-8111-111111111111';
  b uuid := '22222222-2222-4222-8222-222222222222';
  c uuid := '33333333-3333-4333-8333-333333333333';
  hh uuid; code text; j json; n int; r text := ''; ok boolean; t text;
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-a@example.invalid', '', now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-b@example.invalid', '', now(), now()),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-test-c@example.invalid', '', now(), now());
  execute 'set local role authenticated';

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  j := public.tiffo_create_household('Our home', 'Mom'); hh := (j->>'id')::uuid; code := j->>'invite_code';
  insert into public.tiffo_household_items (household_id, kind, data) values (hh, 'split', '{"desc":"Groceries","total":3000}');
  select count(*) into n from public.tiffo_households; r := r || format(E'%s owner sees household\n', n = 1);

  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.tiffo_households; r := r || format(E'%s outsider sees no household\n', n = 0);
  select count(*) into n from public.tiffo_household_items; r := r || format(E'%s outsider sees no items\n', n = 0);
  select count(*) into n from public.tiffo_household_members; r := r || format(E'%s outsider sees no members\n', n = 0);
  begin insert into public.tiffo_household_items (household_id, kind, data) values (hh, 'split', '{}'); ok := false;
  exception when others then ok := true; end;
  r := r || format(E'%s outsider cannot post\n', ok);
  begin perform public.tiffo_join_household('WRONGCODE1', 'X'); ok := false;
  exception when others then ok := true; end;
  r := r || format(E'%s wrong invite code refused\n', ok);

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.tiffo_join_household(lower(code), 'Ana');
  select count(*) into n from public.tiffo_household_items; r := r || format(E'%s member sees shared item\n', n = 1);
  select count(*) into n from public.tiffo_household_members; r := r || format(E'%s member sees both names\n', n = 2);
  insert into public.tiffo_household_items (household_id, kind, data) values (hh, 'settle', '{"amount":500}');
  r := r || E'true member can post\n';
  update public.tiffo_household_items set data = '{"hacked":true}' where author = a;
  delete from public.tiffo_household_items where author = a;
  execute 'reset role';
  select count(*) into n from public.tiffo_household_items where author = a and not data ? 'hacked';
  execute 'set local role authenticated';
  r := r || format(E'%s member cannot edit or delete others'' items\n', n = 1);
  update public.tiffo_household_members set role = 'owner' where user_id = b;
  update public.tiffo_household_members set can_share = false where user_id = a;
  execute 'reset role';
  select (select role from public.tiffo_household_members where user_id = b) = 'member'
     and (select can_share from public.tiffo_household_members where user_id = a and household_id = hh) into ok;
  execute 'set local role authenticated';
  r := r || format(E'%s member cannot change roles or permissions\n', ok);
  begin perform public.tiffo_new_invite_code(hh); ok := false;
  exception when others then ok := true; end;
  r := r || format(E'%s member cannot reset invite code\n', ok);
  begin update public.tiffo_households set owner = b where id = hh;
  exception when others then null; end;
  execute 'reset role';
  select (select owner from public.tiffo_households where id = hh) = a into ok;
  execute 'set local role authenticated';
  r := r || format(E'%s member cannot take over household\n', ok);

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  update public.tiffo_household_members set can_share = false where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin insert into public.tiffo_household_items (household_id, kind, data) values (hh, 'split', '{}'); ok := false;
  exception when others then ok := true; end;
  r := r || format(E'%s sharing switch-off enforced\n', ok);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  delete from public.tiffo_household_items where author = b;
  select count(*) into n from public.tiffo_household_items where author = b; r := r || format(E'%s owner can delete member posts\n', n = 0);
  t := public.tiffo_new_invite_code(hh); r := r || format(E'%s owner can reset code\n', t <> code);
  delete from public.tiffo_household_members where user_id = b;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from public.tiffo_household_items; r := r || format(E'%s removed member loses access\n', n = 0);
  begin perform public.tiffo_join_household(code, 'Ana'); ok := false;
  exception when others then ok := true; end;
  r := r || format(E'%s old invite code stops working\n', ok);

  execute 'reset role'; execute 'set local role anon';
  begin perform count(*) from public.tiffo_household_items; ok := false;
  exception when others then ok := true; end;
  r := r || format(E'%s signed-out visitor blocked\n', ok);
  begin perform public.tiffo_create_household('x', 'y'); ok := false;
  exception when others then ok := true; end;
  r := r || format(E'%s signed-out visitor cannot create\n', ok);

  raise exception E'TEST RESULTS (all rolled back)\n%', r;
end $$;
