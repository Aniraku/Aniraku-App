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

export function getPlaybackType(source: StreamSource): "hls" | "dash" | "native" {
  const raw = `${source.type ?? ""} ${source.mime ?? ""}`.toLowerCase();
  const url = source.url.toLowerCase();
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
  const blocked = /^(user-agent|host|origin|content-length|connection|accept-encoding)$/i;
  const retained = Object.entries(headers ?? {}).filter(([name]) => !blocked.test(name));
  return retained.length ? Object.fromEntries(retained) : undefined;
}

export function anirakuProxyUrl(url: string, headers?: Record<string, string>) {
  const parameters = new URLSearchParams({ url, rn: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
  if (headers && Object.keys(headers).length) parameters.set("headers", JSON.stringify(headers));
  return `${APP_CONFIG.apiBaseUrl}/api/v1/proxy?${parameters.toString()}`;
}

export function anirakuDownloadUrl(url: string, headers?: Record<string, string>) {
  const parameters = new URLSearchParams({ url });
  if (headers && Object.keys(headers).length) parameters.set("headers", JSON.stringify(headers));
  return `${APP_CONFIG.apiBaseUrl}/api/v1/download?${parameters.toString()}`;
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

const UNSUPPORTED_PROVIDERS = new Set(["flixcloud"]);

/** Anikoto returns Momo and Niko. Both support direct or proxy. Deduplicates by name and filters unsupported. */
export async function getServers(animeId: number, episode: number, lang: "sub" | "dub"): Promise<Server[]> {
  try {
    const payload = await apiRequest<any[]>(`/api/v1/servers?animeId=${animeId}&episode=${episode}&lang=${lang}`, undefined, 30_000);
    if (Array.isArray(payload) && payload.length > 0) {
      const seen = new Set<string>();
      const servers: Server[] = [];
      for (const server of payload) {
        const providerName = String(server.provider || "").trim().toLowerCase();
        const displayName = String(server.name || server.provider || "anikoto").trim().toLowerCase();
        if (UNSUPPORTED_PROVIDERS.has(providerName) || UNSUPPORTED_PROVIDERS.has(displayName)) continue;
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
          downloads: server.downloads,
          subtitles: server.subtitles,
        });
      }
      if (servers.length > 0) return servers;
    }
  } catch {}
  // Fallback: Momo and Niko
  return [
    { id: `momo:${lang}`, provider: "momo", label: "MOMO", lang },
    { id: `niko:${lang}`, provider: "niko", label: "NIKO", lang },
  ];
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
