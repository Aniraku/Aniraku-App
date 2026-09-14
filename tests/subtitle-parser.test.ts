import { describe, expect, it } from "vitest";
import {
  detectSubtitleFormat,
  detectSubtitleFormatFromContent,
  findActiveCues,
  matchSubtitleTrack,
  normalizeSubtitleLang,
  parseSubtitle,
} from "../lib/subtitle-parser";

const VTT = `WEBVTT

00:00:01.000 --> 00:00:04.500
Hello <b>world</b> &amp; friends

00:05.200 --> 00:07.000 align:start position:0%
Second cue
`;

const SRT = `1
00:00:01,000 --> 00:00:03,000
First

2
00:00:04,000 --> 00:00:06,000
Second
`;

const ASS = `[Script Info]
Title: Test

[Events]
Format: Layer, Start, End, Style, Text
Dialogue: 0,0:00:01.00,0:00:03.00,Default,Hello\\NWorld
`;

describe("subtitle parser spine", () => {
  it("parses VTT cues with mm:ss timestamps and cleans markup", () => {
    const parsed = parseSubtitle(VTT, "vtt");
    expect(parsed.format).toBe("vtt");
    expect(parsed.cues).toHaveLength(2);
    expect(parsed.cues[0]?.text).toBe("Hello world & friends");
    expect(parsed.cues[0]?.startTime).toBeCloseTo(1, 3);
    expect(parsed.cues[1]?.startTime).toBeCloseTo(5.2, 3);
  });

  it("parses SRT comma timestamps and ASS dialogue lines", () => {
    const srt = parseSubtitle(SRT, "srt");
    expect(srt.cues).toHaveLength(2);
    expect(srt.cues[0]).toMatchObject({ startTime: 1, endTime: 3, text: "First" });
    const ass = parseSubtitle(ASS, "ass");
    expect(ass.cues).toHaveLength(1);
    expect(ass.cues[0]?.text).toBe("Hello\nWorld");
  });

  it("detects format from proxied URLs and content sniffing", () => {
    expect(
      detectSubtitleFormat("https://api.example.com/api/v1/proxy?url=https%3A%2F%2Fcdn.example%2Feng-2.vtt&x=1"),
    ).toBe("vtt");
    expect(detectSubtitleFormat("https://cdn.example/subs.srt")).toBe("srt");
    expect(detectSubtitleFormat("https://cdn.example/subs.ass")).toBe("ass");
    expect(detectSubtitleFormat("https://cdn.example/track")).toBeNull();
    expect(detectSubtitleFormatFromContent("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi")).toBe("vtt");
    expect(detectSubtitleFormatFromContent(ASS)).toBe("ass");
  });

  it("normalizes language labels and matches the preferred track", () => {
    expect(normalizeSubtitleLang("english")).toBe("en");
    expect(normalizeSubtitleLang("en-US")).toBe("en");
    expect(normalizeSubtitleLang("")).toBe("");
    const tracks = [
      { url: "https://cdn.example/ja.vtt", lang: "ja", label: "Japanese" },
      { url: "https://cdn.example/en.vtt", lang: "en", label: "English" },
    ];
    expect(matchSubtitleTrack(tracks, "en")?.url).toBe("https://cdn.example/en.vtt");
    expect(matchSubtitleTrack(tracks, "english")?.url).toBe("https://cdn.example/en.vtt");
    expect(matchSubtitleTrack(tracks, null)?.url).toBe("https://cdn.example/ja.vtt");
    expect(matchSubtitleTrack([], "en")).toBeNull();
  });

  it("finds active cues at a playback position", () => {
    const parsed = parseSubtitle(VTT, "vtt");
    expect(findActiveCues(parsed.cues, 2).map((cue) => cue.text)).toEqual(["Hello world & friends"]);
    expect(findActiveCues(parsed.cues, 10)).toEqual([]);
  });
});
