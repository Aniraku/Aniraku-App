import { APP_CONFIG } from "@/lib/app-config";
import type { Anime, Episode, Server, StreamResponse, StreamSource } from "@/lib/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Offline cache keys ──
const ANIME_CACHE_KEY = (id: number) => `aniraku.cache.anime.${id}`;
const EPISODES_CACHE_KEY = (id: number) => `aniraku.cache.episodes.${id}`;
const TRACK_CACHE_KEY = (id: number) => `aniraku.cache.track.${id}`;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.ts && Date.now() - parsed.ts < CACHE_TTL_MS) return parsed.data;
    return null;
  } catch { return null; }
}

async function writeCache<T>(key: string, data: T) {
  try { await AsyncStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch { /* best effort */ }
}

/** Read cached anime metadata (never throws; null when absent/expired). */
export async function readAnimeCache(animeId: number): Promise<Anime | null> {
  return readCache<Anime>(ANIME_CACHE_KEY(animeId));
}

/** Read cached episodes (never throws; null when absent/expired). */
export async function readEpisodesCache(animeId: number): Promise<Episode[] | null> {
  return readCache<Episode[]>(EPISODES_CACHE_KEY(animeId));
}

/** Cache-aware anime metadata: returns cached copy when offline/stale. */
export async function getAnimeMetadataCached(animeId: number): Promise<Anime> {
  const cached = await readCache<Anime>(ANIME_CACHE_KEY(animeId));
  if (cached) return cached;
  const data = await getAnimeMetadata(animeId);
  void writeCache(ANIME_CACHE_KEY(animeId), data);
  return data;
}

/** Cache-aware episodes: returns cached copy when offline/stale. */
export async function getEpisodesCached(animeId: number): Promise<Episode[]> {
  const cached = await readCache<Episode[]>(EPISODES_CACHE_KEY(animeId));
  if (cached) return cached;
  const data = await getEpisodes(animeId);
  void writeCache(EPISODES_CACHE_KEY(animeId), data);
  return data;
}

/** Cache-aware language track: returns cached copy when offline/stale. */
export async function getLanguageTrackCached(animeId: number): Promise<{ sub: number; dub: number } | null> {
  const cached = await readCache<{ sub: number; dub: number }>(TRACK_CACHE_KEY(animeId));
  if (cached) return cached;
  try {
    const data = await getLanguageTrack(animeId);
    void writeCache(TRACK_CACHE_KEY(animeId), data);
    return data;
  } catch { return null; }
}

async function apiRequest<T>(path: string, init?: RequestInit, timeoutMs: number = 15_000): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      // Every request to api.aniraku.tech (JSON API and media proxy) sits
      // behind a browser gate: requests without a browser UA are 403'd
      // (verified live against /api/v1/health and /api/v1/proxy). The
      // browser UA + site referer pair passes; explicit caller headers
      // (e.g. getLanguageTrack's app identity) still win.
      headers: { Accept: "application/json", ...anirakuProxyRequestHeaders(), ...(init?.headers ?? {}) },
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "AbortError";
    throw new Error(timedOut ? "The video service took too long to respond. Please try again." : "We could not reach Aniraku right now. Please check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }
  const rawPayload = await response.text();
  let payload: { error?: string; message?: string } & T;
  try {
    payload = rawPayload ? JSON.parse(rawPayload) : {} as T;
  } catch {
    throw new Error("The video service sent an unexpected response. Please try again.");
  }
  if (!response.ok) {
    throw new Error(payload.error || payload.message || "The video service is unavailable right now. Please try again.");
  }
  return payload;
}

export const CHROME_ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

/** Desktop browser UA sent to api.aniraku.tech and used as the upstream
 *  fallback UA. Verified live: the backend's gate 403s requests that carry
 *  no browser UA (HTML challenge page), while any UA + a Referer passes. */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Android app referer sent with every proxied request so provider CDNs see
 *  the Aniraku Android app instead of a desktop browser. */
/** Android app referer domain sent on proxied requests so provider CDNs see
 *  the Aniraku Android app instead of a desktop browser. */
export const ANDROID_APP_REFERER = "anime.aniraku.app";

/** Site referer the api.aniraku.tech gate accepts (verified live: browser UA
 *  + this referer returns 200 on both the JSON API and the media proxy; the
 *  app identity referer works too, but this is the fastest verified pair). */
export const ANIRAKU_SITE_REFERER = "https://aniraku.tech/";

/** HTTP headers the app itself sends when calling api.aniraku.tech — both
 *  the JSON API and the media proxy. The gate sits in front of every
 *  manifest, variant, and segment the player fetches, so proxied playback
 *  MUST present this identity or every request 403s. */
export function anirakuProxyRequestHeaders(): Record<string, string> {
  return { "User-Agent": BROWSER_UA, Referer: ANIRAKU_SITE_REFERER };
}

export function getPlaybackType(source: StreamSource): "hls" | "dash" | "native" | "embed" {
  const raw = `${source.type ?? ""} ${source.mime ?? ""}`.toLowerCase();
  const url = String(source.url ?? "").toLowerCase();
  if (raw.includes("embed") || raw.includes("iframe") || raw.includes("page")) return "embed";
  if (raw.includes("dash") || /\.mpd(?:$|[?#])/.test(url)) return "dash";
  if (raw.includes("hls") || raw.includes("mpegurl") || /\.m3u8(?:$|[?#])/.test(url)) return "hls";
  return "native";
}

export function sourceVerification(source: StreamSource) {
  return String(source.verification ?? source.Verification ?? "").toLowerCase();
}

export function hasExpiredEmbeddedToken(url: string) {
  const values = [...url.matchAll(/(?:^|[^0-9])(20\d{12})(?!\d)/g)].map((match) => match[1]);
  let newest = 0;
  for (const stamp of values) {
    const date = Date.UTC(Number(stamp.slice(0, 4)), Number(stamp.slice(4, 6)) - 1, Number(stamp.slice(6, 8)), Number(stamp.slice(8, 10)), Number(stamp.slice(10, 12)), Number(stamp.slice(12, 14)));
    if (Number.isFinite(date)) newest = Math.max(newest, date);
  }
  return newest > 0 && Date.now() > newest + 30_000;
}

export function playableSources(sources: StreamSource[]) {
  return sources.filter((source) => source.url && sourceVerification(source) !== "dead" && !hasExpiredEmbeddedToken(source.url));
}

export function nativePlaybackHeaders(headers?: Record<string, string>) {
  // ExoPlayer (react-native-video DataSourceUtil) forwards a `User-Agent`
  // header when present and falls back to its default UA otherwise. Stripping
  // it caused 403s on UA-locked CDNs, so only transport-managed headers are
  // blocked now. Referer / Origin / Authorization / User-Agent pass through.
  const blocked = /^(host|content-length|connection|accept-encoding)$/i;
  const retained = Object.entries(headers ?? {}).filter(([name]) => !blocked.test(name));
  return retained.length ? Object.fromEntries(retained) : undefined;
}

export function isAnirakuProxyUrl(url: string) {
  return String(url ?? "").includes("/api/v1/proxy?");
}

export function anirakuProxyUrl(url: string, headers?: Record<string, string>) {
  // The backend now returns pre-proxied stream URLs (verification: "proxy",
  // url already points at /api/v1/proxy?...). Re-wrapping them produces a
  // proxy-of-proxy URL that the backend rejects with
  // {"error":"proxy target not allowed"} → HTTP 403 → ExoPlayer
  // ERROR_CODE_IO_BAD_HTTP_STATUS. Play those URLs as-is.
  if (isAnirakuProxyUrl(url)) return url;
  // No cache-buster nonce: tokenized upstream URLs are unique per fetch, and
  // the proxy's edge cache answers repeat requests (cf-cache-status: HIT,
  // immutable segments) — a unique `rn` per wrapper defeated that entirely.
  // Rotted tokens are handled by the variant-refresh guard instead.
  const parameters = new URLSearchParams({ url });
  if (headers && Object.keys(headers).length) {
    // Preserve the provider's own identity: settlar-style CDNs require their
    // exact upstream headers (e.g. Referer: https://ani.pm/anime/ + desktop
    // Chrome) and clobbering them with app values broke the upstream fetch.
    // Only fill a browser UA when the provider supplied none.
    const upstream = { ...headers };
    const hasUa = Object.keys(upstream).some((key) => key.toLowerCase() === "user-agent");
    if (!hasUa) upstream["User-Agent"] = BROWSER_UA;
    parameters.set("headers", JSON.stringify(upstream));
  }
  return `${APP_CONFIG.apiBaseUrl}/api/v1/proxy?${parameters.toString()}`;
}

type BackendSkipSegment = { start?: number; end?: number; startTime?: number; endTime?: number };
type BackendStreamResponse = Omit<StreamResponse, "intro" | "outro"> & { intro?: BackendSkipSegment; outro?: BackendSkipSegment };

export function normalizeStreamResponse(payload: BackendStreamResponse): StreamResponse {
  const normalizeSegment = (segment?: BackendSkipSegment) => segment ? {
    startTime: segment.startTime ?? segment.start,
    endTime: segment.endTime ?? segment.end,
  } : undefined;
  return { ...payload, intro: normalizeSegment(payload.intro), outro: normalizeSegment(payload.outro) };
}

export async function getAnimeMetadata(animeId: number): Promise<Anime> {
  return apiRequest<Anime>(`/api/v1/anime/${animeId}`);
}

type BackendEpisode = Omit<Episode, "isFiller"> & { filler?: boolean; isFiller?: boolean };

function normalizeBackendEpisodes(payload: BackendEpisode[] | { episodes?: BackendEpisode[] }): Episode[] {
  const episodes = Array.isArray(payload) ? payload : payload.episodes;
  if (!Array.isArray(episodes)) throw new Error("Aniraku returned an invalid episode availability response.");
  return episodes.filter(Boolean).map((episode, index) => ({
    number: index + 1,
    title: episode.title,
    thumbnail: episode.thumbnail,
    description: episode.description,
    isFiller: Boolean(episode.isFiller ?? episode.filler),
  }));
}

export async function getEpisodes(animeId: number): Promise<Episode[]> {
  return normalizeBackendEpisodes(await apiRequest<BackendEpisode[] | { episodes?: BackendEpisode[] }>(`/api/v1/anime/${animeId}/episodes`));
}

/** Check if dub is available for a specific episode (returns true if servers exist for lang=dub). */
export async function hasDubForEpisode(animeId: number, episode: number): Promise<boolean> {
  try {
    const payload = await apiRequest<any[]>(`/api/v1/servers?animeId=${animeId}&episode=${episode}&lang=dub`, undefined, 15_000);
    return Array.isArray(payload) && payload.length > 0;
  } catch {
    return false;
  }
}

const UNSUPPORTED_PROVIDERS = new Set(["flixcloud"]);

/** Accept every server the backend returns. Only truly broken providers
 *  (flixcloud) are filtered. Deduplicates by display name so the UI never
 *  shows the same provider twice. */
/** Language-based track availability: returns episode counts per language
 *  for an anime (e.g. { sub: 26, dub: 26 }). Requires Android UA + referer. */
export async function getLanguageTrack(animeId: number): Promise<{ sub: number; dub: number }> {
  return apiRequest<{ sub: number; dub: number }>(`/api/v1/anime/${animeId}/track`, {
    headers: {
      "User-Agent": CHROME_ANDROID_UA,
      "Referer": ANDROID_APP_REFERER,
    },
  });
}

export async function getServers(animeId: number, episode: number, lang: "sub" | "dub"): Promise<Server[]> {
  const payload = await apiRequest<any[]>(`/api/v1/servers?animeId=${animeId}&episode=${episode}&lang=${lang}`, undefined, 30_000);
  if (!Array.isArray(payload) || payload.length === 0) {
    // Empty array is a legitimate "no servers for this language" response —
    // not an error. The caller decides what to do with zero servers.
    return [];
  }
  const collect = (skipUnsupported: boolean) => {
    const seen = new Set<string>();
    const servers: Server[] = [];
    for (const server of payload) {
      const providerName = String(server.provider || "").trim().toLowerCase();
      const displayName = String(server.name || server.provider || "anikoto").trim().toLowerCase();
      if (skipUnsupported && (UNSUPPORTED_PROVIDERS.has(providerName) || UNSUPPORTED_PROVIDERS.has(displayName))) continue;
      const dedupeKey = displayName || providerName;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      servers.push({
        id: server.id || `${dedupeKey}:${lang}:${servers.length}`,
        provider: providerName || dedupeKey,
        label: String(server.name || server.provider || "ANIKOTO").toUpperCase(),
        lang: (server.lang || lang) as "sub" | "dub",
        sources: server.sources,
        headers: server.headers,
        subtitles: server.subtitles,
      });
    }
    return servers;
  };
  const servers = collect(true);
  if (servers.length > 0) return servers;
  // Last resort, not a fallback name: a filtered provider (flixcloud) that is
  // the ONLY thing the backend lists — e.g. hentai embed-only titles — is
  // kept instead of returning nothing. The website plays these (verified live,
  // HTTP 200 embed pages); an honest backend-listed row beats a dead
  // "no streaming" screen, and the player still rotates past it if it dies.
  return collect(false);
}

export async function getStream(input: { animeId: number; episode: number; provider: string; lang: "sub" | "dub"; quality?: string; refresh?: boolean }): Promise<StreamResponse> {
  const payload = await apiRequest<BackendStreamResponse>("/api/v1/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, quality: input.quality || "auto", refresh: Boolean(input.refresh) }),
  });
  return normalizeStreamResponse(payload);
}

export async function healthCheck() {
  return apiRequest<{ status: string }>("/api/v1/health");
}
