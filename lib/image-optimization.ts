import { Image } from "react-native";

// ── Common image sizes (width in dp) ──
export const POSTER_W = 230;
export const THUMBNAIL_W = 320;
export const BANNER_W = 780;
export const COVER_W = 560;
export const AVATAR_W = 120;
export const SCREENSHOT_W = 480;

const ANILIST_CDN_HOSTS = ["s4.anilist.co", "s3.anilist.co", "s2.anilist.co", "s1.anilist.co"];

function isAniListCdn(uri: string): boolean {
  try {
    const url = new URL(uri);
    return ANILIST_CDN_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Returns an optimized image URI for AniList CDN images by appending
 * width and quality query params. Non-AniList URLs are returned as-is.
 */
export function getOptimizedImageUri(uri: string, width: number, quality = 75): string {
  if (!uri) return uri;
  if (!isAniListCdn(uri)) return uri;

  try {
    const url = new URL(uri);
    url.searchParams.set("w", String(width));
    url.searchParams.set("q", String(quality));
    return url.toString();
  } catch {
    return uri;
  }
}

/**
 * Prefetches a batch of image URIs in parallel.
 * Returns a promise that resolves when all prefetches complete (or fail silently).
 */
export async function preloadImages(uris: string[]): Promise<void> {
  const valid = uris.filter((u) => Boolean(u));
  if (valid.length === 0) return;

  await Promise.allSettled(
    valid.map((uri) =>
      Image.prefetch(uri).catch(() => {
        // Silently ignore prefetch failures
      }),
    ),
  );
}
