-- The release-push schedule moved to the dashboard's function scheduler
-- (Supabase sends the service-role JWT automatically — no secret needed).
-- This removes the vault-secret variant that 401s without a Vault entry.
select cron.unschedule('check-new-episodes-every-5-minutes');
