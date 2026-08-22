import AsyncStorage from "@react-native-async-storage/async-storage";

export const ANIRAKU_LATEST_RELEASE_URL = "https://api.github.com/repos/Aniraku/Aniraku-App/releases/latest";
export const UPDATE_CHECK_CACHE_KEY = "aniraku.update.latest-release.v1";
export const UPDATE_CHECK_TTL_MS = 12 * 60 * 60 * 1000;

export type AppRelease = {
  version: string;
  name: string;
  releaseUrl: string;
  downloadUrl: string;
  assetName: string;
  assetSize: number;
  publishedAt?: string;
};

type CachedRelease = { fetchedAt: number; release: AppRelease };

export function normalizeVersion(value?: string | null) {
  const cleaned = String(value ?? "").trim().replace(/^v/i, "");
  const match = cleaned.match(/\d+(?:\.\d+){0,2}/);
  return match ? match[0] : "0.0.0";
}

export function compareVersions(left?: string | null, right?: string | null) {
  const a = normalizeVersion(left).split(".").map(Number);
  const b = normalizeVersion(right).split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

export function trustedAnirakuApkAsset(value: unknown) {
  const asset = value as { name?: unknown; size?: unknown; browser_download_url?: unknown; content_type?: unknown } | null;
  const name = typeof asset?.name === "string" ? asset.name.trim() : "";
  const size = Number(asset?.size);
  const downloadUrl = typeof asset?.browser_download_url === "string" ? asset.browser_download_url.trim() : "";
  try {
    const parsed = new URL(downloadUrl);
    const isReleaseAsset = parsed.origin === "https://github.com"
      && parsed.pathname.startsWith("/Aniraku/Aniraku-App/releases/download/");
    const isApk = name.toLowerCase().endsWith(".apk");
    const isAndroidPackage = !asset?.content_type || asset.content_type === "application/vnd.android.package-archive" || asset.content_type === "application/octet-stream";
    return isReleaseAsset && isApk && isAndroidPackage && Number.isSafeInteger(size) && size > 0
      ? { name, size, downloadUrl }
      : null;
  } catch {
    return null;
  }
}

export function parseGitHubRelease(payload: unknown): AppRelease | null {
  const record = payload as { tag_name?: unknown; name?: unknown; html_url?: unknown; published_at?: unknown; assets?: unknown } | null;
  const version = normalizeVersion(typeof record?.tag_name === "string" ? record.tag_name : "");
  const releaseUrl = typeof record?.html_url === "string" ? record.html_url : "";
  const assets = Array.isArray(record?.assets) ? record.assets.map(trustedAnirakuApkAsset).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset)) : [];
  const preferredAsset = assets.find((asset) => /universal/i.test(asset.name)) ?? assets[0];
  if (version === "0.0.0" || !releaseUrl || !preferredAsset) return null;
  return {
    version,
    name: typeof record?.name === "string" && record.name.trim() ? record.name : `Aniraku v${version}`,
    releaseUrl,
    downloadUrl: preferredAsset.downloadUrl,
    assetName: preferredAsset.name,
    assetSize: preferredAsset.size,
    publishedAt: typeof record?.published_at === "string" ? record.published_at : undefined,
  };
}

export function isReleaseNewer(installedVersion?: string | null, releaseVersion?: string | null) {
  return compareVersions(releaseVersion, installedVersion) > 0;
}

export function updateDismissalKey(releaseVersion: string) {
  return `aniraku.update.dismissed:${normalizeVersion(releaseVersion)}`;
}

export async function getLatestAnirakuRelease(options?: { force?: boolean; fetcher?: typeof fetch; now?: number }): Promise<AppRelease | null> {
  const now = options?.now ?? Date.now();
  if (!options?.force) {
    const cached = await AsyncStorage.getItem(UPDATE_CHECK_CACHE_KEY).catch(() => null);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as CachedRelease;
        if (parsed.release && now - parsed.fetchedAt < UPDATE_CHECK_TTL_MS) return parsed.release;
      } catch {}
    }
  }
  const response = await (options?.fetcher ?? fetch)(ANIRAKU_LATEST_RELEASE_URL, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error("Update status is unavailable right now.");
  const release = parseGitHubRelease(await response.json());
  if (release) void AsyncStorage.setItem(UPDATE_CHECK_CACHE_KEY, JSON.stringify({ fetchedAt: now, release })).catch(() => {});
  return release;
}

export async function checkForAnirakuUpdate(installedVersion: string, options?: { force?: boolean; fetcher?: typeof fetch; now?: number }) {
  const release = await getLatestAnirakuRelease(options);
  return { release, available: Boolean(release && isReleaseNewer(installedVersion, release.version)) };
}
