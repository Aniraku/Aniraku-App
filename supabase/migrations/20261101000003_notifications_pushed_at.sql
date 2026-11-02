-- Push-relay support for the backend's notification pipeline: the Go
-- backend (notify.go) writes notifications rows for every bookmarked user
-- when an episode has a source; check-new-episodes relays them to Expo
-- push tokens and stamps them with pushed_at.

alter table notifications add column if not exists pushed_at timestamptz;

create index if not exists notifications_push_relay_idx
  on notifications (created_at)
  where type = 'new_episode' and pushed_at is null;
