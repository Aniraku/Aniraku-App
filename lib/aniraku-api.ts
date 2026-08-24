import { APP_CONFIG } from "@/lib/app-config";
import type { AiringSchedulePage, Anime, AnimePage, Episode, Server, StreamResponse, StreamSource } from "@/lib/types";

async function apiRequest<T>(path: string, init?: RequestInit, timeoutMs: number = 15_000): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
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

export function getPlaybackType(source: StreamSource): "hls" | "dash" | "native" | "embed" {
  const raw = `${source.type ?? ""} ${source.mime ?? ""}`.toLowerCase();
  const url = source.url.toLowerCase();
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

/**
 * ExoPlayer accepts request headers for direct media, but browser-only or
 * connection-managed headers can make a CDN treat the Android request as an
 * invalid client. Preserve useful headers such as Referer and authorization
 * while allowing the native transport to select its own user agent and
 * connection behavior.
 */
export function nativePlaybackHeaders(headers?: Record<string, string>) {
  const blocked = /^(user-agent|host|origin|content-length|connection|accept-encoding)$/i;
  const retained = Object.entries(headers ?? {}).filter(([name]) => !blocked.test(name));
  return retained.length ? Object.fromEntries(retained) : undefined;
}

/** Mirrors Watch.jsx's `${PROXY_BASE}/proxy` URL shape for native media. */
export function anirakuProxyUrl(url: string, headers?: Record<string, string>) {
  const parameters = new URLSearchParams({ url, rn: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
  if (headers && Object.keys(headers).length) parameters.set("headers", JSON.stringify(headers));
  return `${APP_CONFIG.apiBaseUrl}/api/v1/proxy?${parameters.toString()}`;
}

type BackendSkipSegment = { start?: number; end?: number; startTime?: number; endTime?: number };
type BackendStreamResponse = Omit<StreamResponse, "intro" | "outro"> & { intro?: BackendSkipSegment; outro?: BackendSkipSegment };

/** Align deployed backend `start`/`end` skip fields with the shared native contract. */
export function normalizeStreamResponse(payload: BackendStreamResponse): StreamResponse {
  const normalizeSegment = (segment?: BackendSkipSegment) => segment ? {
    startTime: segment.startTime ?? segment.start,
    endTime: segment.endTime ?? segment.end,
  } : undefined;
  return { ...payload, intro: normalizeSegment(payload.intro), outro: normalizeSegment(payload.outro) };
}

/** Anime Detail metadata comes from the main Aniraku API. */
export async function getAnimeMetadata(animeId: number): Promise<Anime> {
  return apiRequest<Anime>(`/api/v1/anime/${animeId}`);
}

export type AnimePageInput = {
  page?: number;
  perPage?: number;
  search?: string;
  genre?: string;
  format?: string;
  status?: string;
  year?: number;
  sort?: string | string[];
};

function metadataParams(input: AnimePageInput) {
  const params = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((item) => params.append(key, item));
      return;
    }
    params.set(key, String(value));
  });
  return params.toString();
}

const emptyPageInfo: AnimePage["pageInfo"] = { currentPage: 1, hasNextPage: false, total: 0 };

export async function getAnimePage(input: AnimePageInput = {}): Promise<AnimePage> {
  const params = metadataParams(input);
  if (input.search) {
    const searchParams = new URLSearchParams(metadataParams({ ...input, search: undefined }));
    searchParams.set("q", input.search);
    const payload = await apiRequest<{ results?: Anime[]; media?: Anime[]; pageInfo?: AnimePage["pageInfo"] }>(`/api/v1/search?${searchParams.toString()}`);
    return { media: payload.results ?? payload.media ?? [], pageInfo: payload.pageInfo ?? { ...emptyPageInfo, currentPage: input.page ?? 1 } };
  }

  const payload = await apiRequest<{ media?: Anime[]; pageInfo?: AnimePage["pageInfo"] }>(`/api/v1/browse${params ? `?${params}` : ""}`);
  return { media: payload.media ?? [], pageInfo: payload.pageInfo ?? { ...emptyPageInfo, currentPage: input.page ?? 1 } };
}

export async function getTrendingAnime(page = 1, perPage = 20): Promise<Anime[]> {
  const payload = await apiRequest<Anime[] | { media?: Anime[] }>(`/api/v1/trending?page=${page}&perPage=${perPage}`);
  return Array.isArray(payload) ? payload : (payload.media ?? []);
}

export async function getHomeAnime() {
  const [trending, popular, upcoming] = await Promise.all([
    getTrendingAnime(1, 20),
    getAnimePage({ page: 1, perPage: 20, sort: "POPULARITY_DESC" }).then((page) => page.media),
    getAnimePage({ page: 1, perPage: 20, status: "RELEASING", sort: "POPULARITY_DESC" }).then((page) => page.media),
  ]);
  return { trending, popular, upcoming };
}

export async function getAiringSchedule(): Promise<AiringSchedulePage> {
  const payload = await apiRequest<{ schedule?: Array<{ airingAt?: number; episode?: number; media?: Anime }>; pageInfo?: AiringSchedulePage["pageInfo"] }>("/api/v1/schedule?page=1&perPage=100");
  const airingSchedules = (payload.schedule ?? []).flatMap((item) => item.media && Number.isFinite(item.airingAt) && Number.isFinite(item.episode)
    ? [{ airingAt: Number(item.airingAt), episode: Number(item.episode), media: item.media }]
    : []);
  return { airingSchedules, pageInfo: payload.pageInfo ?? emptyPageInfo };
}

export function getKnownMalId(anime?: Partial<Pick<Anime, "idMal" | "malId" | "mal_id" | "myAnimeListId">> | null) {
  const candidate = Number(anime?.idMal ?? anime?.malId ?? anime?.mal_id ?? anime?.myAnimeListId);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
}

export async function getEpisodes(animeId: number): Promise<Episode[]> {
  type MiruroEpisode = Omit<Episode, "isFiller"> & { filler?: boolean; isFiller?: boolean; image?: string; thumbnail?: string };
  type MiruroPayload = { providers?: Record<string, { episodes?: Record<string, MiruroEpisode[]> }> };
  const payload = await apiRequest<MiruroPayload>(`/api/v1/miruro/episodes/${animeId}`);
  const byNumber = new Map<number, MiruroEpisode>();
  Object.values(payload.providers ?? {}).forEach((provider) => {
    Object.values(provider.episodes ?? {}).forEach((list) => {
      if (!Array.isArray(list)) return;
      list.forEach((episode) => {
        const number = Number(episode?.number);
        if (!Number.isFinite(number) || number < 1 || byNumber.has(number)) return;
        byNumber.set(number, episode);
      });
    });
  });
  const episodes = [...byNumber.values()].sort((a, b) => Number(a.number) - Number(b.number));
  if (!episodes.length) throw new Error("Miruro returned no episodes for this anime.");

  // The Aniraku web player and native player share canonical 1-based ordering.
  // This prevents upstream provider sequences such as 10, 20, 30 from reaching
  // the episode picker while retaining the backend’s real titles and thumbnails.
  return episodes.filter(Boolean).map((episode, index) => ({
    number: index + 1,
    title: episode.title,
    thumbnail: episode.thumbnail ?? episode.image,
    description: episode.description,
    isFiller: Boolean(episode.isFiller ?? episode.filler),
  }));
}

export type BackendServer = Partial<Server> & { name?: string; sources?: StreamSource[] };

/** Mirrors the website's server-list normalization without hiding a server from a stale resolver verdict. */
export function normalizeServers(payload: BackendServer[], lang: "sub" | "dub"): Server[] {
  return (Array.isArray(payload) ? payload : []).filter(Boolean).map((server, index) => {
    const publicName = server.name || server.label || server.id || server.provider || `source-${index + 1}`;
    return {
      id: server.id || `${lang}:${publicName}`,
      // `/api/v1/stream` accepts this public provider/server key (for example
      // ally, pewe, kiwi), not the shared upstream adapter name such as miruro.
      provider: server.name || server.provider || publicName,
      label: server.label || publicName.toUpperCase(),
      lang: server.lang || lang,
      verification: server.verification,
      type: server.type,
      ...(server.sources ? { sources: server.sources } : {}),
      ...((server as { headers?: Record<string, string> }).headers ? { headers: (server as { headers?: Record<string, string> }).headers } : {}),
    };
  });
}

export async function getServers(animeId: number, episode: number, lang: "sub" | "dub"): Promise<Server[]> {
  // Source enumeration is deliberately more patient than first-frame startup.
  // A valid provider can need longer than twelve seconds on the free resolver;
  // the website leaves that fetch alive and native must not hide it earlier.
  const payload = await apiRequest<BackendServer[]>(`/api/v1/servers?animeId=${animeId}&episode=${episode}&lang=${lang}`, undefined, 30_000);
  // Keep parity with the website: server-level verification is a stale
  // resolver snapshot, not a reason to hide a current provider. Source-level
  // verification remains enforced when an individual URL is selected.
  return normalizeServers(payload, lang);
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
