import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// lib/downloads touches native surfaces; every one is mocked so the facade's
// pure decision logic (holds, request building, gating) is testable.
const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (key: string) => Promise.resolve(storage.has(key) ? (storage.get(key) as string) : null),
    setItem: (key: string, value: string) => { storage.set(key, value); return Promise.resolve(undefined); },
  },
}));

vi.mock("expo-file-system", () => {
  const join = (parts: Array<{ uri: string } | string>) => parts.map((part) => (typeof part === "string" ? part : part.uri)).join("/");
  class Directory {
    uri: string;
    exists = true;
    constructor(...parts: Array<{ uri: string } | string>) { this.uri = join(parts); }
  }
  class File {
    uri: string;
    exists = true;
    size = 1024;
    constructor(...parts: Array<{ uri: string } | string>) { this.uri = join(parts); }
  }
  const Paths = { document: { uri: "file:///docs" }, availableDiskSpace: 10_000_000_000 };
  return { Directory, File, Paths };
});

vi.mock("expo-network", () => ({
  NetworkStateType: { CELLULAR: "cellular", WIFI: "wifi" },
  getNetworkStateAsync: vi.fn(async () => ({ isConnected: true, type: "wifi" })),
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));

vi.mock("@/lib/aniraku-api", () => ({
  BROWSER_UA: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  getPlaybackType: vi.fn(() => "native"),
  nativePlaybackHeaders: vi.fn((headers?: Record<string, string>) => headers ?? {}),
  sourceVerification: vi.fn(() => "ok"),
  anirakuProxyUrl: vi.fn((url: string) => url),
  isAnirakuProxyUrl: vi.fn(() => false),
  hasExpiredEmbeddedToken: vi.fn(() => false),
}));

vi.mock("@/lib/downloads-native", () => ({
  nativeDownloads: {
    available: true,
    enqueue: vi.fn(),
    cancel: vi.fn(),
    onProgress: vi.fn(() => () => {}),
    onState: vi.fn(() => () => {}),
  },
}));

vi.mock("@/lib/watch-engine", () => ({
  isAutoQuality: (source: { quality?: string | null }) => !source?.quality || /auto/i.test(String(source.quality)),
}));

const { APP_CONFIG } = await import("@/lib/app-config");
const { buildDownloadRequest, resolveDownloadHold, startMaximumQualityDownload } = await import("@/lib/downloads");
const { BROWSER_UA, getPlaybackType } = await import("@/lib/aniraku-api");

const INDEX_KEY = "aniraku.offline-downloads.v1";

describe("resolveDownloadHold", () => {
  it("holds on quota when saved bytes reach the limit", async () => {
    storage.set(INDEX_KEY, JSON.stringify([{ id: "1:1:sub", uri: "file:///d/a.mp4", size: 2 * 1024 * 1024 }]));
    expect(await resolveDownloadHold({ wifiOnly: false, quotaMb: 1 })).toBe("quota");
  });

  it("holds on Wi-Fi when the connection is cellular", async () => {
    const Network = await import("expo-network");
    vi.mocked(Network.getNetworkStateAsync).mockResolvedValueOnce({ isConnected: true, type: Network.NetworkStateType.CELLULAR } as never);
    expect(await resolveDownloadHold({ wifiOnly: true, quotaMb: 0 })).toBe("wifi");
  });

  it("passes clear settings and usable connections", async () => {
    expect(await resolveDownloadHold({ wifiOnly: false, quotaMb: 0 })).toBeNull();
    expect(await resolveDownloadHold({ wifiOnly: true, quotaMb: 0 })).toBeNull();
  });
});

describe("buildDownloadRequest", () => {
  const base = { animeId: 7, episode: 3, language: "sub" as const, title: "Test Anime" };

  it("builds an HLS bundle request from a variant URL", () => {
    const request = buildDownloadRequest({
      ...base,
      source: { url: "https://cdn.example.com/v/ep/master.m3u8", quality: "Auto", type: "hls" },
      variantUrl: "https://cdn.example.com/v/ep/720.m3u8",
      variantQuality: "720p",
      bandwidth: 2_000_000,
    });
    expect(request.kind).toBe("hls");
    expect(request.playlistUrl).toBe("https://cdn.example.com/v/ep/720.m3u8");
    expect(request.quality).toBe("720p");
    expect(request.bandwidth).toBe(2_000_000);
    // Provider headers ride along; the app package marker and a browser UA
    // fallback are injected so UA-locked CDNs never see a generic client.
    expect(request.headers).toEqual({ "X-Requested-With": "aniraku.anime.app", "User-Agent": BROWSER_UA });
    expect(request.downloadUrl).toBe("");
  });

  it("keeps provider-supplied UA and package markers untouched", () => {
    const request = buildDownloadRequest({
      ...base,
      source: { url: "https://cdn.example.com/file.mp4", quality: "720p", type: "file" },
      headers: { Referer: "https://provider.example/", "User-Agent": "ProviderUA/1", "x-requested-with": "provider.app" },
    });
    // Provider-supplied markers pass through verbatim (original casing kept).
    expect(request.headers).toEqual({ Referer: "https://provider.example/", "User-Agent": "ProviderUA/1", "x-requested-with": "provider.app" });
  });

  it("carries the source's subtitle tracks into the request", () => {
    const request = buildDownloadRequest({
      ...base,
      source: { url: "https://cdn.example.com/file.mp4", quality: "720p", type: "file", subtitles: [{ url: "https://cdn.example.com/file.en.vtt", lang: "en", label: "English" }] },
    });
    expect(request.subtitleTracks).toEqual([{ url: "https://cdn.example.com/file.en.vtt", lang: "en", label: "English" }]);
  });

  it("refuses HLS sources that cannot be mounted natively", () => {
    vi.mocked(getPlaybackType).mockReturnValueOnce("embed");
    expect(() => buildDownloadRequest({ ...base, source: { url: "https://cdn.example.com/v/ep.m3u8", quality: "720p", type: "hls" } }))
      .toThrow("cannot be downloaded");
  });

  it("builds a direct progressive request for a downloadable file source", () => {
    const request = buildDownloadRequest({ ...base, source: { url: "https://cdn.example.com/file.mp4", quality: "720p", type: "file" } });
    expect(request.kind).toBe("file");
    expect(request.downloadUrl).toBe("https://cdn.example.com/file.mp4");
    expect(request.filename).toContain(".mp4");
  });

  it("refuses a non-https explicit variant URL", () => {
    expect(() => buildDownloadRequest({ ...base, source: { url: "https://cdn.example.com/file.mp4", quality: "720p", type: "file" }, variantUrl: "http://cdn.example.com/x.m3u8" }))
      .toThrow("unusable download URL");
  });
});

describe("startMaximumQualityDownload gating", () => {
  beforeEach(() => { (APP_CONFIG as { downloadsNativeEnabled: boolean }).downloadsNativeEnabled = true; });
  afterEach(() => { (APP_CONFIG as { downloadsNativeEnabled: boolean }).downloadsNativeEnabled = true; });

  it("throws while the kill switch is off", async () => {
    (APP_CONFIG as { downloadsNativeEnabled: boolean }).downloadsNativeEnabled = false;
    await expect(startMaximumQualityDownload({ animeId: 1, episode: 1, language: "sub", title: "T", source: { url: "https://cdn.example.com/file.mp4", quality: "720p", type: "file" } }))
      .rejects.toThrow("temporarily disabled");
  });
});
