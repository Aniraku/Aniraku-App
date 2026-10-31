# ADR-005: Parallel segment pool for the player

Date: 2026-10-31 · Status: Accepted (beta-gated) · Supersedes: the rejected
localhost-proxy design

## Context

Proxied HLS segments run ~220–600 KB/s per connection while a 720p segment is
~2.7 MB / ~11 s of video; ExoPlayer loads segments strictly one-by-one, so the
buffer can fill slower than playback on a cold cache. The website already
solved this with `src/lib/hlsPrefetch.ts`: an in-memory segment pool — a
driver fetches the next 8 fragments with 3 in flight, a pooled hls.js
`fLoader` serves pooled bytes instantly, and every miss falls through to the
stock loader ("worst case equals stock playback").

## Decision

Port the same mechanism natively via **react-native-video's official plugin
hook** instead of any localhost server or library fork:

- `modules/aniraku-stream-pool/` registers an `RNVExoplayerPlugin`
  (`ReactNativeVideoManager.registerPlugin`).
- `overrideMediaDataSourceFactory` wraps the player's **default** factory in
  a media3 `CacheDataSource` backed by a shared `SimpleCache`
  (`cacheDir/aniraku-pool`, LRU 256 MB). The default factory stays as the
  upstream — its OkHttp client carries the source headers (browser UA +
  referer) **and the bandwidth meter**, so ABR only ever sees real network
  transfers (cache hits produce no samples; the localhost design would have
  poisoned the meter with near-infinite loopback throughput).
- `SegmentPoolListener` (an `AnalyticsListener` attached to the player
  instance the plugin receives) is the driver: completed manifest-type loads
  parse playlists (Kotlin line-scan port of `lib/downloads-hls.ts`; master
  playlists are sniffed and ignored, byte-range playlists are skipped);
  completed media-type loads move the playhead; each move queues the next
  **8 uncached segments** into a **3-thread** executor running `CacheWriter`.
- Segment identity is **by URL** (site `rangeKey` parity), failures are
  dropped and never retried (site parity), and a `generation` counter makes
  stale tasks self-ignore after a session reset (site parity). Live
  playlists warm the same way as VOD — no special case.

### Site parity map

| Website (hls.js)            | App (ExoPlayer)                          |
|-----------------------------|------------------------------------------|
| segment pool `Map`          | `SimpleCache` (disk LRU 256 MB)          |
| pooled `fLoader` hits       | `CacheDataSource` hits                   |
| `warmUpcomingSegments()`    | `SegmentPoolListener` playhead tracking  |
| `prefetchSegments` ≤8 / ≤3  | same constants (LOOKAHEAD=8, CONCURRENCY=3) |
| stock-loader fallthrough    | `CacheDataSource` stream-through miss    |
| `resetSegmentPool()`        | `begin()`/`end()` session bracket        |

### Gating (beta)

`segmentPoolEnabled` is `EXPO_PUBLIC_SEGMENT_POOL === "1"` — set only in the
eas `preview` profile. JS eligibility (`lib/stream-pool.ts`) also requires
HLS + not-offline + not-embed + not-dead + module presence. A player error
while pooled demotes that source to stock playback for its lifetime. With
the flag off, or on iOS/web (module is android-only), nothing changes.

## Consequences

- No new runtime dependencies (media3-datasource ships with
  react-native-video); no cleartext config; no localhost socket; no fork.
- The player mount, ABR, quality menus, and the error/fallback chain are
  untouched — the pool is transparent inside the DataSource.
- Origin concurrency rises ~3× per pooled viewer (segments fetched in
  parallel through the proxy) — hence the beta gate and the production
  rollout decision pending observed origin load.
- Kotlin compiles only in device/CI builds; every media3 API used has been
  verified against the real 1.8.0 source jars (CacheWriter's 4-arg
  `(CacheDataSource, DataSpec, byte[]?, ProgressListener?)` ctor,
  `AnalyticsListener.EventTime` + `source.LoadEventInfo` signatures,
  `SimpleCache`/`CacheDataSource.Factory`/`DataSpec` ctors, `C.DATA_TYPE_*`);
  the JS gate is unit-tested in `tests/stream-pool.test.ts`.
