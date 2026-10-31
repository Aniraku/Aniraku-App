# Release Runbook — Aniraku v5.8.0 (versionCode 77)

Owner: **Showaib Islam** (repository owner — the only named release owner).
Prepared by the agency engagement lead; every command below is executed by the owner from the main session (agent lanes do not push, publish, or deploy).

## Precondition checklist (all verified this engagement)

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| 1 | Typecheck | PASS | `pnpm check` — clean |
| 2 | Unit tests | PASS | `pnpm test` — 306 passed / 5 skipped (5 = env-gated live-API probes) |
| 3 | Lint | PASS | `pnpm lint` — 0 errors / 26 warnings (pre-existing) |
| 4 | Grep gates | PASS | `Alert.alert`=0 · `pickDirectoryAsync`=0 · `openBackendDownload`=0 · `anirakuDownloadUrl`=0 |
| 5 | QA report | DONE | `docs/agency/11-qa-report.md` — code gates PASS |
| 6 | Independent audit | DONE | `docs/agency/12-audit-report.md` — all P1/MEDIUM/P2 fixed, gates re-run |
| 7 | Secrets scan | PASS | audit + QA lanes + final re-audit (tests, scripts, history): no keys/tokens tracked; `.env` gitignored; `supabase/.temp/` + `.zcode/` gitignored |
| 8 | Version alignment | PASS | `app.config.ts` version 5.8.0 / versionCode 77 ↔ tag v5.8.0 ↔ CHANGELOG `v5.8.0` entry (release notes embedded in `build.yml`) |
| 9 | Kill switches | READY | `downloadsNativeEnabled` (lib/app-config.ts) = downloads-off without touching call sites; `segmentPoolEnabled` (env `EXPO_PUBLIC_SEGMENT_POOL`) off in production builds by default |
| 10 | media3 API verification | PASS | every Kotlin call in both native modules checked against real media3 1.8.0 source jars (CacheWriter/EventTime/LoadEventInfo ctors fixed) |
| 11 | Live backend verification | PASS | JSON API, /stream, proxied playback chain (master→variant→segment), subtitles, AniSkip, GraphQL, releases API — all 200 with the shipped header contract |
| 12 | **Device smoke** | **PENDING — owner** | see smoke list below; BLOCKING |

## Server-side pre-steps (NEW — do these BEFORE tagging)

1. **Rotated Supabase key → update the GitHub secret** `EXPO_PUBLIC_SUPABASE_ANON_KEY` (repo Settings → Secrets and variables → Actions). CI bakes it at build time; skipping this ships dead auth.
2. **Apply the 2 new migrations** (`supabase/migrations/`: `push_tokens`, `anime_track_state`) — `supabase db push` or the dashboard SQL editor.
3. **Deploy the 4 edge functions** — `supabase functions deploy delete-account send-push send-campaign check-new-episodes`. They exist only as repo files until this; push + new-episode checks + account deletion (incl. the new `push_tokens` cleanup) are inert server-side until deployed.
4. **Expect one-time sign-outs**: the key rotation invalidates existing sessions. Mention it in the release post.
5. **Beta build (optional, recommended first)**: `eas build --profile preview` carries `EXPO_PUBLIC_SEGMENT_POOL=1` (eas.json) — parallel segment pool ON. Production/CI builds have it OFF.

## Release steps (owner executes, in order)

```bash
# 1 — Review the diff once more (the whole build is one working tree)
git status
git diff --stat

# 2 — Commit the build
git add -A
git commit -m "v5.8.0: offline downloads, push notifications, playback-header fix, segment pool (beta)"

# 3 — Push the branch (consent-gated in this lane; run from your terminal)
git push origin main

# 4 — Tag the release — CI does the rest (validate → 3 APKs → GitHub Release)
git tag v5.8.0
git push origin v5.8.0
```

CI (`.github/workflows/build.yml`, tag-triggered): `validate` (install → check → lint → deterministic tests; live-probe advisory) → `build` (prebuild + `assembleRelease` for arm64 / arm32 / universal; tag↔version mismatch fails fast) → `release` (downloads artifacts, creates the GitHub Release with the notes embedded in build.yml and attaches the three APKs). Track it at `https://github.com/Aniraku/Aniraku-App/actions`.

## Device smoke (blocking, ~20 min, before publishing the release publicly)

1. **Install** the universal APK on a real device (Android 9+; the build targets the Snapdragon 680 legacy-arch constraint).
2. **Download → offline**: open any episode → download icon → pick a quality → confirm the foreground notification appears → let it finish → **airplane mode ON** → open the episode → it plays from the saved copy at the saved quality; quality chips show the saved-quality notice, no silent switch to network.
3. **AES-128 source**: repeat with a provider whose stream is AES-128-encrypted (key downloads, offline playback decrypts).
4. **Cancel / retry / storage**: start a download, cancel mid-way (notification clears, no stray files), retry after a forced failure, and set a tiny quota to see the STORAGE LIMIT hold message in the hub.
5. **Wi-Fi-only**: enable it on cellular → start shows the Wi-Fi hold; the saved copy of a re-download attempt is NOT deleted while held.
6. **Refusals**: DRM/embed/dead source → download sheet shows a clear reason or the press shows a status message; no external link anywhere.
7. **Selector sweep**: delete-download, report-broken-source, save-to-list, history removal — all themed, no OS popups; TalkBack announces notices.
8. **Consent gate**: existing install shows the re-consent sheet once (version 2); Accept → gone; links open the Legal page.
9. **Notifications**: bookmarked title → new episode → notification tap lands on the anime page.
10. **Proxied referer-locked playback**: play an anipm/settlar episode (the class of source that 403'd before the header fix) — playback starts without the 6 s watchdog firing; INFO shows Proxied.
11. **Sign-out / sign-in**: sign out (push token unregisters) → sign in (token re-registers) — validates the rotated-key session flow.
12. **Beta build only**: INFO Source row shows `· POOL` and logcat shows 3 parallel segment fetches after the first segment; quality stays sane under Auto.
13. **Regression soak**: 10 minutes of streaming playback — no regressions (red line).

If smoke fails on downloads specifically: set `downloadsNativeEnabled: false` in `lib/app-config.ts`, rebuild, and ship as a streaming-only release (everything else in this build is independent of it).

## Rollback

| Scenario | Action |
|---|---|
| Downloads broken in the wild | Flip `downloadsNativeEnabled: false` → commit → tag `v5.8.1`; or point users to the previous APK |
| Release APK corrupt | Re-run the `build` workflow via `workflow_dispatch` with tag `v5.8.0` |
| Bad release notes | Edit the Release body on GitHub directly (APKs are unaffected) |
| Consent gate misfires (false re-prompt loop) | Not possible by construction (version compare is monotonic); if the sheet blocks launch, clear app data — record an incident either way |

## Observability

No crash-reporting SDK in the app (sideload distribution). First-week signal = GitHub issues + support email (`sho.islam0311@proton.me`). The live backend probe runs in CI on every tag push (advisory). Metrics targets from the PRD (download success ≥95%, offline start <2s) are not instrumented — accepted gap, next-iteration item.

## Contacts

Release owner: Showaib Islam · support/DMCA/security: sho.islam0311@proton.me · CI: GitHub Actions on this repo.
