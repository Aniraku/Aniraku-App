# Episode Availability and Watch-Flow Investigation

## Verified production contract

The native application must call the authoritative Aniraku backend at `https://api.aniraku.tech`. The public endpoint `GET /api/v1/anime/{anilistId}/episodes` returns HTTP 200 with an object containing an `episodes` array. Each episode can include `number`, `title`, `thumbnail`, and availability metadata. A live probe of anime ID `16498` returned real Attack on Titan episode titles and thumbnails; a sample of IDs from the live Aniraku trending feed also returned HTTP 200 episode responses.

## Browser-preview distinction

The API response body is healthy, but the current preview origin does not receive `Access-Control-Allow-Origin` from the production backend. The backend currently explicitly allows `https://www.aniraku.tech`, while `https://aniraku.tech` and the temporary preview origin are not in the allow-list. Android native requests are not subject to browser CORS; however, browser preview errors must report this distinction clearly instead of calling healthy backend data unavailable.

The local preview now forwards only the required episode and playback contract routes to `api.aniraku.tech`. It refuses unrelated paths. Browser validation on Attack on Titan (AniList ID `16498`) rendered all 25 real episode entries, including provider-supplied titles and the backend filler flag, with canonical 1-based episode selection.

The upgraded watch screen also completed live provider discovery for Attack on Titan episode 1 through the Aniraku backend, selected the `miruro` Sub source, and exposed the custom native 10-second seek, play/pause, next-episode, and player-menu controls. Browser rendering of a third-party HLS stream can remain black while a provider CDN negotiates its own media policy; Android uses `expo-video`/ExoPlayer directly and is validated separately from browser CORS and third-party media restrictions.

The provider discovery strategy now begins native source coordination as soon as either the Sub or Dub server request returns. It no longer holds playback behind the slower language feed, while it still keeps both real Aniraku source lists available in the Player Console once they arrive.

Browser-preview validation on Attack on Titan episode 1 confirmed the current client resolves the real public `ally` Sub provider through the scoped preview forwarder, selects its HLS source, and presents the custom native controls with a 25:40 duration. The browser preview may display a black media plane when the upstream CDN applies a browser-specific media policy; the resolved source, headers, duration, and provider state confirm the Aniraku coordination path is functioning. Android playback uses the native Expo Video / ExoPlayer path rather than browser media handling.

For the reported Android startup failure, the live `ally` HLS master playlist was tested with the backend-supplied Referer and decoded successfully as H.264 video plus AAC audio across 1080p, 720p, and 480p renditions. The native client now removes browser-only transport headers, including the desktop `User-Agent`, before handing a real source to ExoPlayer; retains compatible headers such as Referer and authorization; explicitly configures HLS content type; uses a short native buffer target; unmutes and sets full volume; and moves to the next verified server if a selected source does not begin playback within twelve seconds. These changes are included in the queued signed device-test APK.

The watch surface was reduced to the video plane, a quiet source indicator, back/playback/settings controls, the seek timeline, and next-episode affordance. Source, language, quality, subtitle, skip, and playback preferences now stay in the on-demand Player Settings menu rather than appearing as a separate dashboard beneath the video.

## Authoritative main-site reference map

The native application now treats the `Aniraku/Aniraku` frontend as the behavioral source of truth. Its `Watch.jsx` provides the provider, source, quality, retry, short-lived stream-cache, skip, and player-control contract. `AnimeDetail.jsx`, `Catalog.jsx`, `Home.jsx`, `Schedule.jsx`, `Random.jsx`, `Profile.jsx`, and `Settings.jsx` establish the established product responsibilities that native screens must preserve. The corresponding `useAuth`, `useAnime`, `watchHistory`, `sync`, AniList, and Supabase modules provide the existing session, metadata, library, and synchronization contracts. These are translated into native Expo components, React Query, and Expo Video / ExoPlayer rather than rendered through a site-wide WebView.

Live acceptance against Attack on Titan episode 1 confirms `/api/v1/servers` returns immediate `sources` plus request `headers` for the public `ally`, `pewe`, and `kiwi` providers. The native coordinator now retains precisely these fields, matching the website’s first-play behavior instead of waiting for a second stream lookup before the initial media load begins.

## Website watch-flow reference

The web watch experience establishes the functional baseline for native parity: authoritative provider and language selection, automatic and manual quality selection, subtitles, 10-second seek actions, resume progress, auto-next, verified intro/outro skipping, provider-aware failure handling, and numbered episode navigation. The native implementation should preserve those behaviors through `expo-video` rather than embedding the web player.
