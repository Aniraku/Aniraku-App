/**
 * Pure offline-HLS mechanics: parse a variant media playlist, estimate its
 * byte size, rewrite segment/key URIs to local `file://` paths after a
 * download, and verify the bundle is complete before it may ever play.
 *
 * Everything here is filesystem-free so vitest covers it directly;
 * lib/downloads.ts (facade) and the Android download service wire the I/O.
 * Trust boundary: segment and key URLs must resolve to https only — a
 * playlist is provider-controlled input, never executed blindly.
 */

const EXTINF = /^#EXTINF:([\d.]+)/;
const TAG_ATTRIBUTE = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g;

export type HlsMediaPlaylist = {
  /** Playlist-order segments with their EXTINF duration (seconds). */
  segments: Array<{ uri: string; duration: number }>;
  /** URI of the (single) AES-128 key, or null for clear streams. */
  keyUri: string | null;
  endList: boolean;
};

function parseTagAttributes(line: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const [, key, rawValue] of line.slice(line.indexOf(":") + 1).matchAll(TAG_ATTRIBUTE)) {
    attributes[key] = rawValue.replace(/^"|"$/g, "");
  }
  return attributes;
}

/** Parses a variant media playlist. Null when it carries no segments at all. */
export function parseMediaPlaylist(text: string): HlsMediaPlaylist | null {
  const segments: Array<{ uri: string; duration: number }> = [];
  let keyUri: string | null = null;
  let endList = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF:")) {
      const duration = Number.parseFloat(EXTINF.exec(line)?.[1] ?? "");
      if (!Number.isFinite(duration) || duration < 0) return null;
      // The segment URI is the next non-empty, non-comment line; hang it on a
      // pending slot and fill it when that line arrives.
      segments.push({ uri: "", duration });
      continue;
    }
    if (line.startsWith("#EXT-X-KEY")) {
      const uri = parseTagAttributes(line).URI;
      if (uri) keyUri = uri;
      continue;
    }
    if (line.startsWith("#EXT-X-ENDLIST")) { endList = true; continue; }
    if (line.startsWith("#")) continue;
    const pending = segments.findLast((segment) => segment.uri === "");
    if (!pending) return null;
    pending.uri = line;
  }

  if (!segments.length || segments.some((segment) => !segment.uri)) return null;
  return { segments, keyUri, endList };
}

/**
 * Resolves a playlist URI against the playlist URL. Returns the absolute URL
 * only when it is a clean https fetch target — no other scheme, no embedded
 * credentials, no whitespace tricks.
 */
export function resolveSegmentUrl(uri: string, baseUrl: string): string | null {
  const candidate = String(uri ?? "").trim();
  if (!candidate || /[\s<>"']/.test(candidate)) return null;
  try {
    const parsed = new URL(candidate, baseUrl);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** EXTINF sum × bandwidth ÷ 8, with a small muxing overhead factor. Null when unknown. */
export function estimateHlsSize(playlistText: string, bandwidth: number): number | null {
  const playlist = parseMediaPlaylist(playlistText);
  if (!playlist || !Number.isFinite(bandwidth) || bandwidth <= 0) return null;
  const seconds = playlist.segments.reduce((total, segment) => total + segment.duration, 0);
  if (seconds <= 0) return null;
  // 2% covers container framing and the key fetch — a guess, stated as one.
  return Math.round((seconds * bandwidth / 8) * 1.02);
}

type RewriteInput = {
  baseUrl: string;
  /** Absolute URL → local `file://` URI, or null when that part never downloaded. */
  mapUri: (absoluteUrl: string) => string | null;
};

/**
 * Rewrites every segment URI (and the AES-128 key URI) of a downloaded
 * variant playlist to its local file. One unmappable URI fails the whole
 * rewrite: a playlist that half-points at the network must never exist.
 */
export function rewritePlaylistUris(text: string, input: RewriteInput): string | null {
  const playlist = parseMediaPlaylist(text);
  if (!playlist) return null;

  const localUri = (uri: string) => {
    const absolute = resolveSegmentUrl(uri, input.baseUrl);
    return absolute ? input.mapUri(absolute) : null;
  };
  const keyLocal = playlist.keyUri ? localUri(playlist.keyUri) : null;
  if (playlist.keyUri && !keyLocal) return null;

  const out: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) { out.push(""); continue; }
    if (line.startsWith("#EXT-X-KEY")) {
      if (!line.includes('URI="')) { out.push(line); continue; }
      // Replace only the URI value — IV= and other attributes must survive.
      out.push(line.replace(/URI="[^"]*"/, `URI="${keyLocal}"`));
      continue;
    }
    if (line.startsWith("#EXTINF:")) { out.push(line); continue; }
    if (line.startsWith("#")) { out.push(line); continue; }
    const mapped = localUri(line);
    if (!mapped) return null;
    out.push(mapped);
  }
  return out.join("\n");
}

/**
 * Formats the bundle pipeline cannot reproduce, checked before any download
 * starts: fMP4 init segments, byte-range segments, and playlists that rotate
 * encryption keys. Null means the playlist is representable.
 */
export function unsupportedPlaylistReason(text: string): string | null {
  // Tag-line match only (^#EXT-X-…): the bare word "byterange" inside a
  // comment or a segment path must not refuse an otherwise clean playlist.
  if (/^#EXT-X-MAP[\s:]/m.test(text) || /^#EXT-X-BYTERANGE[\s:]/m.test(text)) return "This stream's format cannot be saved.";
  if (new Set([...text.matchAll(/#EXT-X-KEY:.*?URI="([^"]+)"/g)].map((match) => match[1])).size > 1) return "This stream's encryption cannot be saved.";
  return null;
}

/**
 * Final gate before a download may play: every URI must already be local,
 * every file present, and the playlist must be a finished VOD. `exists`
 * receives the rewritten playlist's URIs so vitest stays FS-free.
 */
export function verifyPlaylistIntegrity(text: string, exists: (uri: string) => boolean): boolean {
  const playlist = parseMediaPlaylist(text);
  if (!playlist || !playlist.endList) return false;
  // A rewritten bundle may keep only local keys — a remote key means the
  // rewrite failed or a new key appeared after download.
  if (playlist.keyUri && !playlist.keyUri.startsWith("file://")) return false;
  for (const segment of playlist.segments) {
    if (!segment.uri.startsWith("file://")) return false;
    let present = false;
    try { present = exists(segment.uri); } catch { present = false; }
    if (!present) return false;
  }
  if (playlist.keyUri) {
    let keyPresent = false;
    try { keyPresent = exists(playlist.keyUri); } catch { keyPresent = false; }
    if (!keyPresent) return false;
  }
  return true;
}
