-- Re-schedule the release-push relay now that CRON_SECRET is set on the
-- function and the matching value goes into Vault (name: release_cron_secret).
-- The cron command reads the value from Vault at every firing — no secret
-- lives in this file.

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
