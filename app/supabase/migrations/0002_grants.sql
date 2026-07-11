-- Explicit Data API GRANTs for the `authenticated` role.
--
-- Local dev has been working only because `auto_expose_new_tables = true` in
-- supabase/config.toml auto-grants Data API privileges to new public-schema
-- objects — a local-CLI-only compatibility setting. A real hosted Supabase
-- project defaults to revoking Data API privileges on new objects, so without
-- explicit GRANTs here, every `supabase.from(...)`/`supabase.rpc(...)` call
-- from the app would fail with permission-denied, regardless of the RLS
-- policies defined in 0001 — RLS restricts which *rows* a query can touch,
-- but the role still needs a GRANT to touch the table/function at all.
--
-- `GRANT USAGE ON SCHEMA public` is deliberately NOT included here: verified
-- against the local stack (with auto_expose_new_tables = false) that
-- `authenticated`/`anon` already have schema-level USAGE by default,
-- independent of this flag, so adding it here would be an unjustified grant.
--
-- `public.is_campaign_member` and `public.handle_new_user` are intentionally
-- NOT granted EXECUTE here — both are internal helpers, invoked only from
-- inside RLS policies (as the table owner, via the function's own SECURITY
-- DEFINER context) or the `auth.users` trigger, never called directly by
-- client code.

grant select, update on public.profiles to authenticated;
grant select on public.campaigns to authenticated;
grant select on public.campaign_memberships to authenticated;
grant select on public.campaign_invitations to authenticated;

grant execute on function public.create_campaign(text) to authenticated;
grant execute on function public.create_campaign_invitation(uuid) to authenticated;
grant execute on function public.redeem_campaign_invitation(text) to authenticated;

-- Per Supabase's own revoke-by-default change (supabase/supabase discussion
-- #45329), this new default also revokes Data API privileges from
-- `service_role` on new public-schema objects, not just `anon`/`authenticated`.
-- The app itself never uses the service-role key, but this repo's own
-- integration test suite (tests/integration/campaigns.rpc.test.ts) does, via
-- an admin client, to delete campaign rows during test cleanup — so this
-- grant is verified necessary (not speculative) for that admin client to
-- keep working against a hosted-realistic (auto_expose_new_tables = false)
-- project, exactly like Finding 2's own verification step exercises.
grant select, delete on public.campaigns to service_role;
