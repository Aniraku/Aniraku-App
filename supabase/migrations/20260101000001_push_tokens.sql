-- Enable push notifications for users via Expo push service (FCM/APNs under the hood).
-- No self-hosting: Expo hosts the push relay for free. This table stores device
-- push tokens so the backend can send pushes to signed-in users even when the app is closed.

create table if not exists public.push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null unique,
  platform text check (platform in ('android', 'ios', 'web')) not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- One row per user+token; upsert on token conflict so re-registration is idempotent.
create index if not exists idx_push_tokens_user_id on public.push_tokens(user_id);

-- RLS: users can only manage their own push tokens.
alter table public.push_tokens enable row level security;

create policy "users insert own push tokens"
  on public.push_tokens
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users select own push tokens"
  on public.push_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users update own push tokens"
  on public.push_tokens
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete own push tokens"
  on public.push_tokens
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Service role can manage all tokens (needed by the send-push Edge Function).
create policy "service role manages all push tokens"
  on public.push_tokens
  for all
  to service_role
  using (true)
  with check (true);
