-- Applied 27 Nov 2026 as migration "tiffo_vault_guard" (encrypted vault).
-- Once an account's cloud copy is encrypted, refuse unencrypted overwrites (older app versions,
-- devices that haven't unlocked the vault). Only an explicit turn-off write (vaultOff: true) may go back.
create or replace function tiffo_private.guard_vault() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (old.data ? 'vault') and not (new.data ? 'vault') and coalesce(new.data->>'vaultOff', '') <> 'true' then
    raise exception 'This Tiffo account is encrypted; refusing to replace it with unencrypted data.' using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function tiffo_private.guard_vault() from public, anon, authenticated;
drop trigger if exists tiffo_data_vault_guard on public.tiffo_data;
create trigger tiffo_data_vault_guard before update on public.tiffo_data
  for each row execute function tiffo_private.guard_vault();
-- Tested 27 Nov 2026 on a temporary table: plain→plain, plain→encrypted, encrypted→encrypted allowed;
-- encrypted→plain refused (also with vaultOff=false); explicit turn-off allowed. 6/6.
