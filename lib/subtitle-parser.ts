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
  const match = ts.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!match) return NaN;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = parseInt(match[3], 10);
  const ms = match[4] ? parseInt(match[4].padEnd(3, "0"), 10) : 0;
  return h * 3600 + m * 60 + s + ms / 1000;
}

function cleanText(raw: string): string {
  return raw
    .replace(/\{\\an\d+\}/g, "")
    .replace(/\{\\pos[^}]*\}/g, "")
    .replace(/\\N/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function parseVTT(content: string): ParsedSubtitle {
  const cues: SubtitleCue[] = [];
  const blocks = content.replace(/^WEBVTT.*?\n\n/s, "").split(/\n\s*\n/);
  let id = 0;
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    let timeLineIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx < 0) continue;
    const timeLine = lines[timeLineIdx];
    const timeParts = timeLine.split("-->");
    if (timeParts.length < 2) continue;
    const startTime = timestampToSeconds(timeParts[0]);
    const endTime = timestampToSeconds(timeParts[1].split(/[\s{]/)[0]);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) continue;
    const text = cleanText(lines.slice(timeLineIdx + 1).join("\n"));
    if (!text) continue;
    cues.push({ id: ++id, startTime, endTime, text });
  }
  return { cues, format: "vtt" };
}

function parseSRT(content: string): ParsedSubtitle {
  const cues: SubtitleCue[] = [];
  const blocks = content.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  let id = 0;
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 2) continue;
    let timeLineIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeLineIdx < 0) continue;
    const timeLine = lines[timeLineIdx];
    const timeParts = timeLine.replace(/,/g, ".").split("-->");
    if (timeParts.length < 2) continue;
    const startTime = timestampToSeconds(timeParts[0]);
    const endTime = timestampToSeconds(timeParts[1].trim());
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) continue;
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
  const lower = url.toLowerCase();
  if (lower.endsWith(".vtt") || lower.includes(".vtt?")) return "vtt";
  if (lower.endsWith(".srt") || lower.includes(".srt?")) return "srt";
  if (lower.endsWith(".ass") || lower.includes(".ass?")) return "ass";
  return null;
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
