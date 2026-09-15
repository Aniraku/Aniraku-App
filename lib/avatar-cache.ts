/**
 * Avatar file cache. Device image loaders (Coil/Fresco) deterministically fail
 * on the Supabase storage avatar URLs while the app's own fetch stack reaches
 * the same host fine — so avatars bypass image-loader networking entirely:
 * bytes are downloaded with the proven stack into the app cache directory and
 * rendered from `file://`, which decoders always handle. Pure helpers live
 * here so vitest can pin the contracts.
 */

export const AVATAR_CACHE_SUBDIR = "aniraku-avatars";

/** Stable djb2 hex digest — a filename-safe identity for a URL. */
export function hashAvatarUrl(url: string) {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash + url.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function extensionFor(url: string) {
  const clean = url.split("?")[0] ?? url;
  const match = clean.match(/\.(png|jpe?g|webp|gif)$/i);
  return (match?.[1] ?? "jpg").toLowerCase().replace("jpeg", "jpg");
}

/** Deterministic cache filename for an avatar URL (hash + real extension). */
export function avatarCacheFileName(url: string) {
  return `${hashAvatarUrl(url)}.${extensionFor(url)}`;
}
