import { APP_CONFIG } from "@/lib/app-config";
import type { Anime, Episode, Server, StreamResponse, StreamSource } from "@/lib/types";

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

/** Main Watch.jsx loads this backend payload before falling back to AniList. */
export async function getAnimeMetadata(animeId: number): Promise<Anime> {
  return apiRequest<Anime>(`/api/v1/anime/${animeId}`);
}

type BackendEpisode = Omit<Episode, "isFiller"> & { filler?: boolean; isFiller?: boolean };
type MiruroEpisode = {
  number?: number;
  title?: string | null;
  image?: string | null;
  thumbnail?: string | null;
  description?: string | null;
  filler?: boolean;
  fillerType?: string | null;
};
type MiruroEpisodePayload = { providers?: Record<string, { episodes?: { sub?: MiruroEpisode[]; dub?: MiruroEpisode[] } }> };

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

export function normalizeMiruroEpisodes(payload: MiruroEpisodePayload): Episode[] {
  const providerRows = Object.values(payload.providers ?? {})
    .flatMap((provider) => [provider.episodes?.sub, provider.episodes?.dub])
    .filter((episodes): episodes is MiruroEpisode[] => Array.isArray(episodes));
  const sourceEpisodes = providerRows.sort((left, right) => right.length - left.length)[0];
  if (!sourceEpisodes?.length) throw new Error("Miruro returned no real episode availability for this anime.");

  const unique = new Map<number, MiruroEpisode>();
  for (const episode of sourceEpisodes) {
    const number = Number(episode.number);
    if (Number.isInteger(number) && number >= 1 && !unique.has(number)) unique.set(number, episode);
  }
  const episodes = [...unique.entries()].sort(([left], [right]) => left - right).map(([number, episode]) => ({
    number,
    title: episode.title ?? undefined,
    thumbnail: episode.image ?? episode.thumbnail ?? undefined,
    description: episode.description ?? undefined,
    isFiller: Boolean(episode.filler || episode.fillerType?.toLowerCase().includes("filler")),
  }));
  if (!episodes.length) throw new Error("Miruro returned no numbered episode availability for this anime.");
  return episodes;
}

async function getFallbackEpisodes(animeId: number): Promise<Episode[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${APP_CONFIG.episodeFallbackBaseUrl}/episodes/${animeId}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const rawPayload = await response.text();
    if (!response.ok) throw new Error("Miruro episode availability is unavailable.");
    let payload: MiruroEpisodePayload;
    try {
      payload = rawPayload ? JSON.parse(rawPayload) as MiruroEpisodePayload : {};
    } catch {
      throw new Error("Miruro episode availability was not valid JSON.");
    }
    return normalizeMiruroEpisodes(payload);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getEpisodes(animeId: number): Promise<Episode[]> {
  try {
    return normalizeBackendEpisodes(await apiRequest<BackendEpisode[] | { episodes?: BackendEpisode[] }>(`/api/v1/anime/${animeId}/episodes`));
  } catch {
    try {
      return await getFallbackEpisodes(animeId);
    } catch {
      throw new Error("Episode availability is temporarily unavailable from both sources. Please try again.");
    }
  }
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
