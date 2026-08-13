import { APP_CONFIG } from "@/lib/app-config";
import type { Episode, Server, StreamResponse, StreamSource } from "@/lib/types";

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${APP_CONFIG.apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Aniraku service is unavailable (${response.status}).`);
  return response.json() as Promise<T>;
}

export function getPlaybackType(source: StreamSource): "hls" | "dash" | "native" | "embed" {
  const raw = `${source.type ?? ""} ${source.mime ?? ""}`.toLowerCase();
  const url = source.url.toLowerCase();
  if (raw.includes("embed") || raw.includes("iframe")) return "embed";
  if (raw.includes("dash") || /\.mpd(?:$|[?#])/.test(url)) return "dash";
  if (raw.includes("hls") || raw.includes("mpegurl") || /\.m3u8(?:$|[?#])/.test(url)) return "hls";
  return "native";
}

export function hasExpiredEmbeddedToken(url: string) {
  const values = [...url.matchAll(/(?:^|[^0-9])(20\d{12})(?!\d)/g)].map((match) => match[1]);
  return values.some((stamp) => {
    const date = Date.UTC(Number(stamp.slice(0, 4)), Number(stamp.slice(4, 6)) - 1, Number(stamp.slice(6, 8)), Number(stamp.slice(8, 10)), Number(stamp.slice(10, 12)), Number(stamp.slice(12, 14)));
    return Number.isFinite(date) && Date.now() > date + 30_000;
  });
}

export function playableSources(sources: StreamSource[]) {
  return sources.filter((source) => source.url && source.verification?.toLowerCase() !== "dead" && !hasExpiredEmbeddedToken(source.url));
}

export async function getEpisodes(animeId: number): Promise<Episode[]> {
  const payload = await apiRequest<Episode[] | { episodes?: Episode[] }>(`/api/v1/anime/${animeId}/episodes`);
  const episodes = Array.isArray(payload) ? payload : payload.episodes ?? [];
  return episodes.filter(Boolean).map((episode, index) => ({ ...episode, number: index + 1 }));
}

export async function getServers(animeId: number, episode: number, lang: "sub" | "dub"): Promise<Server[]> {
  const payload = await apiRequest<Server[]>(`/api/v1/servers?animeId=${animeId}&episode=${episode}&lang=${lang}`);
  return (Array.isArray(payload) ? payload : []).filter((server) => server?.verification?.toLowerCase() !== "dead");
}

export async function getStream(input: { animeId: number; episode: number; provider: string; lang: "sub" | "dub"; refresh?: boolean }): Promise<StreamResponse> {
  return apiRequest<StreamResponse>("/api/v1/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, quality: "auto", refresh: Boolean(input.refresh) }),
  });
}

export async function healthCheck() {
  return apiRequest<{ status: string }>("/api/v1/health");
}
