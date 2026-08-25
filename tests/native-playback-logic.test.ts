import { describe, expect, it } from "vitest";
import { anirakuProxyUrl, getPlaybackType, hasExpiredEmbeddedToken, nativePlaybackHeaders, normalizeServers, normalizeStreamResponse, playableSources } from "../lib/aniraku-api";
import { getKnownMalId } from "../lib/anilist";
import { shouldAllowEmbedNavigation } from "../lib/embed-navigation";
import { adaptiveVideoCacheBytes, NATIVE_STREAM_BUFFER_OPTIONS } from "../lib/playback-buffer-policy";
import { chooseResumeEpisode, progressFraction } from "../lib/watch-progress";
import { bonkHasDirectOrProxySource, directSources, embedSources, episodePageCount, episodePageFor, episodePageSlice, filterConditionalAllyProviders, filterProviderChoices, FUTURE_RELEASE_MESSAGE, hasConfirmedPlaybackStart, isBonkProvider, isConfirmedFutureRelease, isProxySource, mergeProviderServers, nativeSources, nextProviderIndex, normalizeAniSkipSegments, providerDiscoveryCopy, PROVIDER_DISCOVERY_RETRY_DELAYS_MS, proxySources, shouldApplyInitialHistoryResume, shouldHoldRebufferWatermark, shouldMountReplacementSource, shouldRetryProxiedSourceAfterDirect, usableProvider } from "../lib/watch-engine";

describe("Aniraku native playback coordination", () => {
  it("keeps only Android-safe transport headers for direct media", () => {
    expect(nativePlaybackHeaders({ Referer: "https://allmanga.to/", "User-Agent": "browser", Origin: "https://example.com", Authorization: "Bearer token" })).toEqual({ Referer: "https://allmanga.to/", Authorization: "Bearer token" });
  });

  it("uses the same Aniraku proxy request contract as Watch.jsx before direct-media fallback", () => {
    const proxied = anirakuProxyUrl("https://cdn.example/episode.m3u8", { Referer: "https://provider.example/", "User-Agent": "browser" });
    expect(proxied).toContain("https://api.aniraku.tech/api/v1/proxy?");
    expect(decodeURIComponent(proxied)).toContain("url=https://cdn.example/episode.m3u8");
    expect(decodeURIComponent(proxied)).toContain('headers={"Referer":"https://provider.example/","User-Agent":"browser"}');
  });

  it("normalizes the deployed backend skip segment fields used by Watch.jsx", () => {
    const stream = normalizeStreamResponse({ sources: [], intro: { start: 47.3, end: 137.3 }, outro: { start: 1344.9, end: 1434.9 } });
    expect(stream.intro).toEqual({ startTime: 47.3, endTime: 137.3 });
    expect(stream.outro).toEqual({ startTime: 1344.9, endTime: 1434.9 });
  });

  it("classifies HLS, DASH, direct media, and non-native embeds correctly", () => {
    expect(getPlaybackType({ url: "https://cdn.example/stream.m3u8" })).toBe("hls");
    expect(getPlaybackType({ url: "https://cdn.example/stream.mpd" })).toBe("dash");
    expect(getPlaybackType({ url: "https://cdn.example/stream.webm" })).toBe("native");
    expect(getPlaybackType({ url: "https://host.example/frame", type: "embed" })).toBe("embed");
    expect(getPlaybackType({ url: "https://host.example/watch/episode", type: "page" })).toBe("embed");
  });

  it("keeps only verified, non-expired sources", () => {
    const sources = playableSources([
      { url: "https://cdn.example/alive.m3u8", verification: "verified" },
      { url: "https://cdn.example/dead.m3u8", verification: "dead" },
      { url: "" },
      { url: "https://cdn.example/token?expires=20200101000000" },
    ]);
    expect(sources).toEqual([{ url: "https://cdn.example/alive.m3u8", verification: "verified" }]);
    expect(hasExpiredEmbeddedToken("https://cdn.example/token?expires=20200101000000")).toBe(true);
  });

  it("keeps direct, proxy, and verified embeds separately eligible in Direct → Proxy → Embed order", () => {
    const response = {
      sources: [
        { url: "https://direct.example/720.m3u8", quality: "720p", verification: "verified" },
        { url: "https://cdn.example/720.m3u8", quality: "720p", verification: "proxy" },
        { url: "https://cdn.example/master.m3u8", quality: "Auto", Verification: "proxy" },
        { url: "https://cdn.example/1080.m3u8", quality: "1080p", verification: "proxy" },
        { url: "https://embed.example/watch", type: "embed", verification: "embed" },
        { url: "https://page.example/watch", type: "page", Verification: "embed" },
      ],
    };
    expect(directSources(response).map((source) => source.url)).toEqual([
      "https://direct.example/720.m3u8",
    ]);
    expect(proxySources(response).map((source) => source.url)).toEqual([
      "https://cdn.example/master.m3u8",
      "https://cdn.example/1080.m3u8",
      "https://cdn.example/720.m3u8",
    ]);
    expect(nativeSources(response).map((source) => source.url)).toEqual([
      "https://direct.example/720.m3u8",
      "https://cdn.example/master.m3u8",
      "https://cdn.example/1080.m3u8",
      "https://cdn.example/720.m3u8",
    ]);
    expect(embedSources(response).map((source) => source.url)).toEqual(["https://embed.example/watch", "https://page.example/watch"]);
    expect(isProxySource(response.sources[1])).toBe(true);
    expect(usableProvider({ id: "sub:proxy", provider: "proxy", label: "PROXY", lang: "sub", sources: [response.sources[1]] })).toBe(true);
  });

  it("retains a website-visible server even when a stale verification snapshot is dead and its source is resolved only by /stream", () => {
    const servers = normalizeServers([{ name: "kiwi", provider: "miruro", verification: "dead" }], "sub");
    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({ id: "sub:kiwi", provider: "kiwi", lang: "sub" });
  });

  it("keeps Ally only while it is the sole source-bearing fallback and preserves an active Ally row", () => {
    const ally = { id: "sub:ally", provider: "ally", label: "ALLY", lang: "sub" as const, sources: [{ url: "https://cdn.example/ally.m3u8", verification: "proxy" }] };
    const bonk = { id: "sub:bonk", provider: "bonk", label: "BONK", lang: "sub" as const, sources: [{ url: "https://cdn.example/bonk.m3u8", verification: "proxy" }] };
    expect(PROVIDER_DISCOVERY_RETRY_DELAYS_MS).toEqual([0, 5_000, 10_000, 15_000, 20_000, 30_000]);
    expect(filterConditionalAllyProviders([ally])).toEqual([ally]);
    expect(filterConditionalAllyProviders([ally, bonk])).toEqual([bonk]);
    expect(filterConditionalAllyProviders([ally, bonk], ally.id)).toEqual([ally, bonk]);
    expect(mergeProviderServers([ally], [{ ...ally, sources: [{ url: "https://cdn.example/fresh-ally.m3u8", verification: "proxy" }] }, bonk])[0].sources?.[0].url).toContain("fresh-ally");
  });

  it("keeps Bonk only when real direct or proxy media is present and never treats an embed as Bonk playback", () => {
    const directBonk = { id: "sub:bonk-direct", provider: "bonk", label: "BONK", lang: "sub" as const, sources: [{ url: "https://cdn.example/bonk.m3u8", verification: "verified" }] };
    const proxyBonk = { id: "sub:bonk-proxy", provider: "bonk", label: "BONK", lang: "sub" as const, sources: [{ url: "https://cdn.example/bonk-proxy.m3u8", verification: "proxy" }] };
    const embeddedBonk = { id: "sub:bonk-embed", provider: "bonk", label: "BONK", lang: "sub" as const, sources: [{ url: "https://player.example/embed/bonk", type: "embed", verification: "embed" }] };
    expect(isBonkProvider(directBonk)).toBe(true);
    expect(bonkHasDirectOrProxySource(directBonk)).toBe(true);
    expect(bonkHasDirectOrProxySource(proxyBonk)).toBe(true);
    expect(bonkHasDirectOrProxySource(embeddedBonk)).toBe(false);
    expect(filterProviderChoices([embeddedBonk, directBonk, proxyBonk])).toEqual([directBonk, proxyBonk]);
  });

  it("reports bounded provider-discovery progress without pretending a provider is ready", () => {
    expect(providerDiscoveryCopy({ attempt: 0, providersDiscovered: 0 })).toEqual({ title: "FINDING PROVIDERS", detail: "CHECK 1 OF 6" });
    expect(providerDiscoveryCopy({ attempt: 9, providersDiscovered: 0 })).toEqual({ title: "FINDING PROVIDERS", detail: "CHECK 6 OF 6" });
    expect(providerDiscoveryCopy({ attempt: 2, providersDiscovered: 3 })).toEqual({ title: "PROVIDERS FOUND", detail: "3 READY · CHECKING FOR MORE" });
  });

  it("blocks confirmed future episodes and movies before provider lookup without blocking released titles", () => {
    const released = [{ number: 1 }, { number: 2 }, { number: 3 }];
    expect(isConfirmedFutureRelease({ episodeNumber: 4, episodes: released, status: "RELEASING", hasConfirmedEpisodeList: true })).toBe(true);
    expect(isConfirmedFutureRelease({ episodeNumber: 3, episodes: released, status: "RELEASING", hasConfirmedEpisodeList: true })).toBe(false);
    expect(isConfirmedFutureRelease({ episodeNumber: 1, status: "NOT_YET_RELEASED" })).toBe(true);
    expect(isConfirmedFutureRelease({ episodeNumber: 1, nextAiringEpisode: { episode: 1 } })).toBe(true);
    expect(isConfirmedFutureRelease({ episodeNumber: 1, status: "FINISHED" })).toBe(false);
    expect(FUTURE_RELEASE_MESSAGE).toContain("Time travel still has not been invented");
  });

  it("uses known backend or AniList metadata IDs before a separate AniSkip fallback lookup", () => {
    expect(getKnownMalId({ idMal: 21 })).toBe(21);
    expect(getKnownMalId({ malId: 22 })).toBe(22);
    expect(getKnownMalId({ mal_id: 23 })).toBe(23);
    expect(getKnownMalId({ myAnimeListId: 24 })).toBe(24);
    expect(getKnownMalId({ idMal: 0 })).toBeNull();
  });

  it("normalizes AniSkip v2 opening and ending payloads with nested intervals", () => {
    const segments = normalizeAniSkipSegments({ results: [
      { skipType: "op", interval: { startTime: 28.783, endTime: 118.783 } },
      { skipType: "ed", interval: { startTime: 1387.996, endTime: 1500 } },
    ] });
    expect(segments).toEqual({
      intro: { startTime: 28.783, endTime: 118.783, source: "aniskip" },
      outro: { startTime: 1387.996, endTime: 1500, source: "aniskip" },
    });
  });

  it("paginates high-episode-count titles without rendering more than one bounded page", () => {
    const episodes = Array.from({ length: 1173 }, (_, index) => index + 1);
    expect(episodePageCount(episodes.length)).toBe(24);
    expect(episodePageFor(1173)).toBe(23);
    expect(episodePageSlice(episodes, 0)).toHaveLength(50);
    expect(episodePageSlice(episodes, 23)).toEqual(episodes.slice(1150));
  });

  it("preserves an already-mounted initial source during background metadata refresh", () => {
    expect(shouldMountReplacementSource(false, false)).toBe(true);
    expect(shouldMountReplacementSource(true, false)).toBe(false);
    expect(shouldMountReplacementSource(true, true)).toBe(true);
  });

  it("does not mistake a ready-but-unrendered source for successful playback", () => {
    expect(hasConfirmedPlaybackStart({ isPlaying: false, currentTime: 0, firstFrameRendered: false })).toBe(false);
    expect(hasConfirmedPlaybackStart({ isPlaying: false, currentTime: 0, firstFrameRendered: true })).toBe(true);
    expect(hasConfirmedPlaybackStart({ isPlaying: true, currentTime: 0, firstFrameRendered: false })).toBe(false);
    expect(hasConfirmedPlaybackStart({ isPlaying: false, currentTime: 1, firstFrameRendered: false })).toBe(true);
    expect(shouldRetryProxiedSourceAfterDirect(false, false)).toBe(true);
    expect(shouldRetryProxiedSourceAfterDirect(true, false)).toBe(false);
    expect(shouldRetryProxiedSourceAfterDirect(false, true)).toBe(false);
  });

  it("holds only the UI/history watermark for small non-user rebuffer rollbacks without requesting a native seek", () => {
    expect(shouldHoldRebufferWatermark({ lastStableTime: 125.5, reportedTime: 125.2, wasBuffering: true, playbackStarted: true, intentionalSeek: false })).toBe(true);
    expect(shouldHoldRebufferWatermark({ lastStableTime: 125.5, reportedTime: 125.2, wasBuffering: true, playbackStarted: true, intentionalSeek: true })).toBe(false);
    expect(shouldHoldRebufferWatermark({ lastStableTime: 125.5, reportedTime: 110, wasBuffering: true, playbackStarted: true, intentionalSeek: false })).toBe(false);
    expect(shouldHoldRebufferWatermark({ lastStableTime: 125.5, reportedTime: 125.2, wasBuffering: false, playbackStarted: true, intentionalSeek: false })).toBe(false);
  });

  it("allows a saved history position only during a fresh source start, never after a rebuffer ready event", () => {
    expect(shouldApplyInitialHistoryResume({ currentTime: 0, hasPendingResume: true, isPlaying: false, resumeAppliedForSource: false, status: "readyToPlay" })).toBe(true);
    expect(shouldApplyInitialHistoryResume({ currentTime: 0.5, hasPendingResume: true, isPlaying: true, resumeAppliedForSource: false, status: "readyToPlay" })).toBe(true);
    expect(shouldApplyInitialHistoryResume({ currentTime: 58, hasPendingResume: true, isPlaying: false, resumeAppliedForSource: false, status: "readyToPlay" })).toBe(false);
    expect(shouldApplyInitialHistoryResume({ currentTime: 0, hasPendingResume: true, isPlaying: true, resumeAppliedForSource: true, status: "readyToPlay" })).toBe(false);
  });

  it("uses a refillable time-priority reserve with a short rebuffer resume cushion and no fixed byte allocator limit", () => {
    expect(NATIVE_STREAM_BUFFER_OPTIONS).toEqual({
      maxBufferBytes: 0,
      minBufferForPlayback: 8,
      preferredForwardBufferDuration: 120,
      prioritizeTimeOverSizeThreshold: true,
      waitsToMinimizeStalling: true,
    });
  });

  it("sizes the persistent stream cache from available device storage while retaining Android free space", () => {
    expect(adaptiveVideoCacheBytes(undefined)).toBe(1024 * 1024 * 1024);
    expect(adaptiveVideoCacheBytes(3 * 1024 * 1024 * 1024)).toBe(256 * 1024 * 1024);
    expect(adaptiveVideoCacheBytes(10 * 1024 * 1024 * 1024)).toBe(2 * 1024 * 1024 * 1024);
    expect(adaptiveVideoCacheBytes(40 * 1024 * 1024 * 1024)).toBe(4 * 1024 * 1024 * 1024);
  });

  it("allows provider navigation while refusing known advertising and popup targets", () => {
    expect(shouldAllowEmbedNavigation("https://ok.ru/videoembed/123")).toBe(true);
    expect(shouldAllowEmbedNavigation("https://cdn.provider.example/stream")).toBe(true);
    expect(shouldAllowEmbedNavigation("https://ad.doubleclick.net/redirect")).toBe(false);
    expect(shouldAllowEmbedNavigation("https://cdn.juicyads.com/interstitial")).toBe(false);
    expect(shouldAllowEmbedNavigation("https://push.house/landing")).toBe(false);
    expect(shouldAllowEmbedNavigation("intent://untrusted")).toBe(false);
  });

  it("fails over to the next provider in the selected language before giving up", () => {
    const providers = [
      { id: "sub:ally", provider: "ally", label: "ALLY", lang: "sub" as const },
      { id: "sub:pewe", provider: "pewe", label: "PEWE", lang: "sub" as const },
      { id: "dub:ally", provider: "ally", label: "ALLY", lang: "dub" as const },
    ];
    expect(nextProviderIndex(providers, 0, new Set([providers[0].id]), true)).toBe(1);
    expect(nextProviderIndex(providers, 1, new Set([providers[0].id, providers[1].id]), true)).toBe(-1);
  });

  it("resumes after the furthest completed episode before earlier partial playback", () => {
    const entries = [
      { episode_number: 7, progress: 450, duration: 600 },
      { episode_number: 8, progress: 600, duration: 600 },
      { episode_number: 2, progress: 599, duration: 600 },
    ];
    expect(progressFraction(entries[0])).toBe(0.75);
    expect(chooseResumeEpisode(entries)).toBe(9);
    expect(chooseResumeEpisode([{ episode_number: 4, progress: 222, duration: 600 }])).toBe(4);
    expect(chooseResumeEpisode([])).toBe(1);
  });
});
