-- Track last known language track counts per anime for new-episode push detection.
-- sub_count = number of episodes with subtitles (eps 1..sub_count)
-- dub_count = number of episodes with dub (eps 1..dub_count)
-- The backend /track endpoint returns these totals; an increase means new
-- episodes landed in that language for the range (prev+1 .. current).
create table if not exists public.anime_track_state (
  anime_id bigint primary key,
  sub_count integer not null default 0,
  dub_count integer not null default 0,
  last_checked_at timestamptz default now() not null
);

-- RLS: authenticated users can read; service_role manages all (Edge Function).
alter table public.anime_track_state enable row level security;

create policy "public read anime track state"
  on public.anime_track_state
  for select
  to authenticated
  using (true);

create policy "service role manages anime track state"
  on public.anime_track_state
  for all
  to service_role
  using (true)
  with check (true);

-- Index for the Edge Function's state lookups by anime_id (primary key already covers this).
create index if not exists idx_anime_track_state_last_checked on public.anime_track_state(last_checked_at);
