export type SubtitleCue = {
  id: number;
  startTime: number;
  endTime: number;
  text: string;
  style?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    color?: string;
    fontSize?: number;
  };
};

export type ParsedSubtitle = {
  cues: SubtitleCue[];
  format: "vtt" | "srt" | "ass";
};

function timestampToSeconds(ts: string): number {
  // Accepts hh:mm:ss.mmm, mm:ss.mmm and ss.mmm (dot or comma separator).
  // The old regex required hh:mm:ss so common VTT cues like
  // "00:01.200 --> 00:04.500" parsed as NaN and produced zero cues.
  const cleaned = ts.trim().replace(",", ".");
  const parts = cleaned.split(":");
  if (parts.length === 0 || parts.length > 3) return NaN;
  let seconds = 0;
  // Last segment is seconds (with optional .mmm fraction).
  const last = parts[parts.length - 1];
  const secMatch = last.match(/^(\d{1,3})(?:\.(\d{1,3}))?$/);
  if (!secMatch) return NaN;
  seconds += parseInt(secMatch[1], 10);
  if (secMatch[2]) seconds += parseInt(secMatch[2].padEnd(3, "0"), 10) / 1000;
  if (parts.length >= 2) {
    const minutes = Number(parts[parts.length - 2]);
    if (!Number.isFinite(minutes) || minutes < 0) return NaN;
    seconds += minutes * 60;
  }
  if (parts.length >= 3) {
    const hours = Number(parts[parts.length - 3]);
    if (!Number.isFinite(hours) || hours < 0) return NaN;
    seconds += hours * 3600;
  }
  return seconds;
}

function cueTimestampToken(raw: string): string {
  // "00:00:01.000 align:start position:0%" -> "00:00:01.000"
  return raw.trim().split(/\s+/)[0].split("{")[0];
}

function cleanText(raw: string): string {
  return raw
    .replace(/\{[^}]*\}/g, "")
    .replace(/\\N/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function parseVTT(content: string): ParsedSubtitle {
  const cues: SubtitleCue[] = [];
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Strip a flexible WEBVTT header (may use \n\n, \n or have no trailing blank line).
  const withoutHeader = normalized.replace(/^WEBVTT[^\n]*\n/, "");
  const blocks = withoutHeader.split(/\n\s*\n/);
  let id = 0;
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const upper = trimmed.toUpperCase();
    if (upper.startsWith("NOTE") || upper.startsWith("STYLE") || upper.startsWith("REGION")) continue;
    const lines = trimmed.split("\n");
    if (lines.length < 1) continue;
    const timeLineIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx < 0) continue;
    const timeLine = lines[timeLineIdx];
    const timeParts = timeLine.split("-->");
    if (timeParts.length < 2) continue;
    const startTime = timestampToSeconds(cueTimestampToken(timeParts[0]));
    const endTime = timestampToSeconds(cueTimestampToken(timeParts[1]));
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) continue;
    const text = cleanText(lines.slice(timeLineIdx + 1).join("\n"));
    if (!text) continue;
    cues.push({ id: ++id, startTime, endTime, text });
  }
  return { cues, format: "vtt" };
}

function parseSRT(content: string): ParsedSubtitle {
  const cues: SubtitleCue[] = [];
  const blocks = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split(/\n\s*\n/);
  let id = 0;
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    const timeLineIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx < 0) continue;
    const timeLine = lines[timeLineIdx];
    const timeParts = timeLine.replace(/,/g, ".").split("-->");
    if (timeParts.length < 2) continue;
    const startTime = timestampToSeconds(cueTimestampToken(timeParts[0]));
    const endTime = timestampToSeconds(cueTimestampToken(timeParts[1]));
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) continue;
    const text = cleanText(lines.slice(timeLineIdx + 1).join("\n"));
    if (!text) continue;
    cues.push({ id: ++id, startTime, endTime, text });
  }
  return { cues, format: "srt" };
}

function parseASSTime(ts: string): number {
  const match = ts.trim().match(/^(\d+):(\d{2}):(\d{2})(?:\.(\d{2}))?$/);
  if (!match) return NaN;
  return parseInt(match[1], 10) * 3600 + parseInt(match[2], 10) * 60 + parseInt(match[3], 10) + parseInt(match[4] || "0", 10) / 100;
}

function parseASS(content: string): ParsedSubtitle {
  const cues: SubtitleCue[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let inEvents = false;
  let formatFields: string[] = [];
  let id = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase() === "[events]") { inEvents = true; continue; }
    if (trimmed.startsWith("[")) { inEvents = false; continue; }
    if (!inEvents) continue;
    if (trimmed.toLowerCase().startsWith("format:")) {
      formatFields = trimmed.slice(7).split(",").map((f) => f.trim().toLowerCase());
      continue;
    }
    if (!trimmed.toLowerCase().startsWith("dialogue:")) continue;
    const value = trimmed.slice(9);
    const parts = value.split(",");
    if (parts.length < formatFields.length) continue;
    const textIdx = formatFields.indexOf("text");
    const startIdx = formatFields.indexOf("start");
    const endIdx = formatFields.indexOf("end");
    if (textIdx < 0 || startIdx < 0 || endIdx < 0) continue;
    const startTime = parseASSTime(parts[startIdx]);
    const endTime = parseASSTime(parts[endIdx]);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) continue;
    const rawText = parts.slice(textIdx).join(",").trim();
    const text = cleanText(rawText);
    if (!text) continue;
    cues.push({ id: ++id, startTime, endTime, text });
  }
  return { cues, format: "ass" };
}

export function detectSubtitleFormat(url: string): "vtt" | "srt" | "ass" | null {
  // Backend URLs are often proxied (/api/v1/proxy?url=<encoded>&...)
  // so the extension appears mid-string followed by "&", not "?" or EOS.
  // Decode first so "%2Fsub.vtt" style targets are still detectable.
  let haystack = String(url ?? "").toLowerCase();
  try {
    haystack = decodeURIComponent(haystack);
  } catch {
    // Keep the raw lowercased URL when decoding fails.
  }
  if (haystack.includes(".vtt")) return "vtt";
  if (haystack.includes(".srt")) return "srt";
  if (haystack.includes(".ass") || haystack.includes(".ssa")) return "ass";
  return null;
}

export function detectSubtitleFormatFromContent(content: string): "vtt" | "srt" | "ass" {
  const head = String(content ?? "").slice(0, 2048).trim();
  if (/^WEBVTT/i.test(head)) return "vtt";
  if (/\[events\]/i.test(head) && /dialogue:/i.test(String(content).slice(0, 8192))) return "ass";
  // SRT and VTT both use "-->", default to VTT parsing which tolerates
  // both hh:mm:ss and mm:ss timestamps.
  return head.includes("-->") ? "vtt" : "srt";
}

const LANGUAGE_ALIASES: Record<string, string> = {
  english: "en",
  eng: "en",
  spanish: "es",
  french: "fr",
  german: "de",
  arabic: "ar",
  hindi: "hi",
  portuguese: "pt",
  indonesian: "id",
  japanese: "ja",
  spanishlatin: "es",
};

export function normalizeSubtitleLang(value?: string | null): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  // "en-US", "en_US", "en[cc]" -> "en"
  const base = raw.split(/[^a-z]+/)[0] || raw;
  return LANGUAGE_ALIASES[base] ?? LANGUAGE_ALIASES[raw] ?? base;
}

export type SubtitleTrackLike = { url: string; label?: string; lang?: string };

export function matchSubtitleTrack(
  tracks: readonly SubtitleTrackLike[] | undefined,
  preferredLanguage?: string | null,
): SubtitleTrackLike | null {
  if (!tracks?.length) return null;
  const preferred = normalizeSubtitleLang(preferredLanguage);
  if (!preferred) return tracks[0] ?? null;
  // Exact normalized match on lang or label first.
  for (const track of tracks) {
    if (normalizeSubtitleLang(track.lang) === preferred) return track;
    if (normalizeSubtitleLang(track.label) === preferred) return track;
  }
  // Prefix match ("en" matches "en-us", "english" etc.).
  for (const track of tracks) {
    const lang = normalizeSubtitleLang(track.lang);
    const label = normalizeSubtitleLang(track.label);
    if (lang.startsWith(preferred) || preferred.startsWith(lang) || label.startsWith(preferred) || preferred.startsWith(label)) {
      if (lang || label) return track;
    }
  }
  return tracks[0] ?? null;
}

export function parseSubtitle(content: string, format: "vtt" | "srt" | "ass"): ParsedSubtitle {
  switch (format) {
    case "vtt": return parseVTT(content);
    case "srt": return parseSRT(content);
    case "ass": return parseASS(content);
    default: return { cues: [], format: "vtt" };
  }
}

export function findActiveCues(cues: SubtitleCue[], currentTime: number): SubtitleCue[] {
  return cues.filter((cue) => currentTime >= cue.startTime && currentTime <= cue.endTime);
}
