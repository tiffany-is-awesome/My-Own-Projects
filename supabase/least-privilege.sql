-- Applied 27 Nov 2026 as migration "tiffo_least_privilege" (security audit).
-- TRUNCATE ignores row-level security, and the app never uses TRUNCATE, TRIGGER or REFERENCES.
revoke truncate, trigger, references on public.tiffo_data, public.tiffo_households, public.tiffo_household_members, public.tiffo_household_items from anon, authenticated;
revoke all on public.tiffo_data from anon;
