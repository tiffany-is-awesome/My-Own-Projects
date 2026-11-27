-- Wearwise: check that one user can't read, change or delete another user's closet or photos.
-- Safe to run any time: it creates two throwaway users inside ONE transaction and always ends with an error on
-- purpose, which rolls everything back. Nothing is saved. Read the result in the error message:
-- the expected result is
--   A sees rows=1 | A sees B=0 | A updates B=0 | A deletes B=0 | A inserts for someone else=denied | A updates own=1
--   | A writes photo into B folder=denied | A writes own photo=allowed | A sees B photos=0
--   | visitor reading=denied | visitor photos=0 (or denied)
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); r text := ''; n int;
begin
  insert into auth.users (id, email, aud, role, instance_id) values
    (a, 'rls-test-a@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (b, 'rls-test-b@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  insert into public.wearwise_data (user_id, data) values (a, '{"who":"a"}'), (b, '{"who":"b"}');

  -- act as signed-in user A
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.wearwise_data; r := r || 'A sees rows=' || n;
  select count(*) into n from public.wearwise_data where user_id = b; r := r || ' | A sees B=' || n;
  update public.wearwise_data set data = '{"hacked":1}' where user_id = b; get diagnostics n = row_count; r := r || ' | A updates B=' || n;
  delete from public.wearwise_data where user_id = b; get diagnostics n = row_count; r := r || ' | A deletes B=' || n;
  begin insert into public.wearwise_data (user_id, data) values (gen_random_uuid(), '{}'); r := r || ' | A inserts for someone else=ALLOWED';
  exception when others then r := r || ' | A inserts for someone else=denied'; end;
  update public.wearwise_data set data = '{"ok":1}' where user_id = a; get diagnostics n = row_count; r := r || ' | A updates own=' || n;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('wearwise-photos', b::text || '/x.webp', a::text); r := r || ' | A writes photo into B folder=ALLOWED';
  exception when others then r := r || ' | A writes photo into B folder=denied'; end;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('wearwise-photos', a::text || '/x.webp', a::text); r := r || ' | A writes own photo=allowed';
  exception when others then r := r || ' | A writes own photo=denied (' || sqlerrm || ')'; end;
  execute 'reset role';

  -- B has a photo; A must not see it
  insert into storage.objects (bucket_id, name, owner_id) values ('wearwise-photos', b::text || '/secret.webp', b::text);
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'wearwise-photos' and name like b::text || '/%'; r := r || ' | A sees B photos=' || n;
  execute 'reset role';

  -- not signed in at all
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  begin select count(*) into n from public.wearwise_data; r := r || ' | visitor sees rows=' || n;
  exception when others then r := r || ' | visitor reading=denied'; end;
  begin select count(*) into n from storage.objects where bucket_id = 'wearwise-photos'; r := r || ' | visitor sees photos=' || n;
  exception when others then r := r || ' | visitor photos=denied'; end;
  execute 'reset role';

  raise exception 'RLS TEST RESULT (everything rolled back): %', r;
end $$;
