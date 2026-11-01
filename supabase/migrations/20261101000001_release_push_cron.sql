-- Release-push cron: runs check-new-episodes every 5 minutes so push
-- notifications fire the moment an episode releases, without waiting for
-- an app open. Requires the pg_cron and pg_net extensions (enable in the
-- Supabase dashboard → Database → Extensions).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Store the cron auth secret in Vault (never inline in this file):
--   1. Dashboard → Edge Functions → check-new-episodes → Add secret:
--        CRON_SECRET = <pick a long random string>
--   2. Dashboard → Database → Vault → create the same value with name
--        'release_cron_secret'
--   3. Then run this migration.

select cron.schedule(
  'check-new-episodes-every-5-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://sbjdrjaovcgvttfnpfsz.supabase.co/functions/v1/check-new-episodes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'release_cron_secret' limit 1),
        ''
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
