/**
 * Real-network E2E for the offline-download pipeline (device-free).
 *
 * Exercises the ACTUAL production path against REAL provider URLs, the same
 * way the app does it from a user's device (direct CDN + playback headers):
 *   health → trending (AniList mirror) → episodes → servers → stream sources
 *   → classify (mirrors lib/downloads.ts buildDownloadRequest — keep in sync)
 *   → HLS: master → variants → variant playlist → refusals → estimate
 *          → download first segments + AES key → full rewrite → integrity gate
 *   → progressive: HEAD preflight math + first-byte proof with headers
 *   → proxy regression: /api/v1/proxy still serves the master (red line)
 *
 * Run: npx tsx scripts/e2e-downloads.ts
 * Exit 0 = harness completed (provider failures are findings, not crashes).
 * Exit 1 = every source failed or the harness itself broke.
 */
import {
  estimateHlsSize,
  parseMediaPlaylist,
  resolveSegmentUrl,
  unsupportedPlaylistReason,
  rewritePlaylistUris,
  verifyPlaylistIntegrity,
} from "../lib/downloads-hls";
import { originalStreamUrl, parseHlsMasterVariants } from "../lib/hls-variants";
import {
  anirakuProxyUrl,
  getAnimeMetadata,
  getEpisodes,
  getPlaybackType,
  getServers,
  getStream,
  healthCheck,
  nativePlaybackHeaders,
  sourceVerification,
} from "../lib/aniraku-api";

import type { StreamSource } from "../lib/types";

const FETCH_TIMEOUT_MS = 15_000;
const POLITENESS_MS = 120;
const SEGMENTS_TO_PROVE = 3;
const ANIME_TO_TRY = 3;
const SERVERS_PER_ANIME = 3;
const SOURCES_PER_SERVER = 2;
const BUNDLE_DIR = "/tmp/opencode/aniraku-e2e-bundle";

/**
 * Public real-CDN test streams: real playlists, real segments, real AES-128
 * keys, real token-free CDNs — everything except the Aniraku backend, which
 * Cloudflare-challenges datacenter IPs (run `--providers` from a residential
 * machine, e.g. the user's; build.yml documents the same CI behavior).
 */
const PUBLIC_HLS_TARGETS: { label: string; url: string; note: string }[] = [
  { label: "apple bipbop TS (multi-variant, AES-128)", url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8", note: "classic Apple test stream: TS segments + AES-128 key" },
  { label: "apple bipbop fMP4 (advanced, AES-128)", url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8", note: "fMP4 init-segment stream — should hit the EXT-X-MAP refusal" },
  { label: "mux x36xhzz (clear TS, multi-variant)", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", note: "clear multi-variant TS" },
  { label: "mux pts_shift (live-ish edge)", url: "https://test-streams.mux.dev/pts_shift/master.m3u8", note: "VOD with unusual timestamps" },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

type Finding = { source: string; verdict: "PASS" | "FAIL" | "REFUSED" | "SKIP"; detail: string };
const findings: Finding[] = [];
let passCount = 0;
let failCount = 0;

function record(source: string, verdict: Finding["verdict"], detail: string) {
  findings.push({ source, verdict, detail });
  const mark = verdict === "PASS" ? "✓" : verdict === "FAIL" ? "✗" : verdict === "REFUSED" ? "⊘" : "–";
  console.log(`  ${mark} [${verdict}] ${source} — ${detail}`);
  if (verdict === "PASS") passCount += 1;
  if (verdict === "FAIL") failCount += 1;
}

/** Mirrors lib/downloads.ts buildDownloadRequest classification — keep in sync. */
function classify(source: StreamSource) {
  const url = String(source.url ?? "");
  const unwrapped = originalStreamUrl(url);
  const isHls = /\.m3u8($|[?#])/i.test(unwrapped) || /mpegurl/i.test(String(source.mime || source.type || ""));
  const headers = nativePlaybackHeaders((source as { headers?: Record<string, string> }).headers) ?? {};
  const authBearing = Object.keys(headers).some((name) => /^authorization$/i.test(name));
  const dead = sourceVerification(source) === "dead";
  const embed = getPlaybackType(source) === "embed";
  const httpsDirect = /^https:\/\//i.test(unwrapped);
  return { url, unwrapped, isHls, headers, authBearing, dead, embed, httpsDirect };
}

/** Download one segment/key exactly like the native service does. */
async function downloadBytes(url: string, headers: Record<string, string>): Promise<{ bytes: number; status: number }> {
  const response = await fetchWithTimeout(url, { headers });
  if (!response.ok) return { bytes: 0, status: response.status };
  const buffer = await response.arrayBuffer();
  return { bytes: buffer.byteLength, status: response.status };
}

async function e2eHlsSource(label: string, classified: ReturnType<typeof classify>, opts: { skipProxyRegression?: boolean } = {}) {
  const { unwrapped, headers } = classified;

  // Streaming red-line regression: the proxy must still serve the master.
  if (!opts.skipProxyRegression) {
  try {
    const proxied = anirakuProxyUrl(unwrapped, headers);
    const proxyResponse = await fetchWithTimeout(proxied, { headers: { Accept: "*/*" } });
    const proxyText = await proxyResponse.text();
    const looksPlaylist = /#EXTM3U/.test(proxyText);
    record(`${label} · proxy regression`, proxyResponse.ok && looksPlaylist ? "PASS" : "FAIL",
      `proxy ${proxyResponse.status}, playlist marker ${looksPlaylist ? "present" : "MISSING"}`);
  } catch (cause) {
    record(`${label} · proxy regression`, "FAIL", String(cause instanceof Error ? cause.message : cause));
  }
  }

  // Master playlist + variants (direct CDN, with playback headers — as built).
  const masterResponse = await fetchWithTimeout(unwrapped, { headers });
  if (!masterResponse.ok) {
    record(`${label} · master fetch`, "FAIL", `CDN returned ${masterResponse.status} with playback headers`);
    return;
  }
  const masterText = await masterResponse.text();
  const variants = parseHlsMasterVariants(masterText, unwrapped);
  if (!variants.length) {
    record(`${label} · master parse`, "FAIL", "no picture variants parsed from the real master");
    return;
  }
  record(`${label} · variants`, "PASS", `${variants.length} renditions: ${variants.map((v) => `${v.height}p@${Math.round(v.bandwidth / 1000)}k`).join(", ")}`);

  // Variant media playlist through the REAL gates.
  const top = variants[0];
  const playlistResponse = await fetchWithTimeout(top.url, { headers });
  if (!playlistResponse.ok) {
    record(`${label} · variant fetch`, "FAIL", `variant ${top.height}p returned ${playlistResponse.status}`);
    return;
  }
  const playlistText = await playlistResponse.text();
  const refusal = unsupportedPlaylistReason(playlistText);
  if (refusal) {
    record(`${label} · preflight`, "REFUSED", refusal);
    return;
  }
  const parsed = parseMediaPlaylist(playlistText);
  if (!parsed) {
    record(`${label} · parse`, "FAIL", "parseMediaPlaylist rejected a real provider playlist");
    return;
  }
  if (!parsed.endList) {
    record(`${label} · preflight`, "REFUSED", "live/endless stream (no ENDLIST) — correctly un-downloadable");
    return;
  }
  const estimate = estimateHlsSize(playlistText, top.bandwidth);
  record(`${label} · estimate`, estimate ? "PASS" : "FAIL",
    estimate ? `~${(estimate / 1024 / 1024).toFixed(1)} MB estimated for ${parsed.segments.length} segments` : "estimate returned null on a real VOD playlist");

  // Segment + key fetch proof (first N segments, service-style).
  let downloadedBytes = 0;
  let segmentFailures = 0;
  const proven: string[] = [];
  for (let index = 0; index < Math.min(SEGMENTS_TO_PROVE, parsed.segments.length); index += 1) {
    const absolute = resolveSegmentUrl(parsed.segments[index].uri, top.url);
    if (!absolute) { segmentFailures += 1; continue; }
    try {
      const result = await downloadBytes(absolute, headers);
      if (result.status >= 200 && result.status < 300 && result.bytes > 0) {
        downloadedBytes += result.bytes;
        proven.push(`seg${index}=${(result.bytes / 1024).toFixed(0)}KB`);
      } else {
        segmentFailures += 1;
      }
    } catch { segmentFailures += 1; }
    await sleep(POLITENESS_MS);
  }
  record(`${label} · segments`, segmentFailures === 0 && proven.length > 0 ? "PASS" : "FAIL",
    proven.length ? `${proven.join(", ")} (${segmentFailures} failed)` : "no segment could be fetched with the playback headers");
  if (proven.length) {
    const perSegment = downloadedBytes / proven.length;
    const projected = perSegment * parsed.segments.length;
    const drift = estimate ? Math.abs(projected - estimate) / estimate : 1;
    record(`${label} · estimate honesty`, drift < 0.5 ? "PASS" : "FAIL",
      `projected ${(projected / 1024 / 1024).toFixed(1)} MB vs estimated ${estimate ? (estimate / 1024 / 1024).toFixed(1) : "?"} MB (drift ${(drift * 100).toFixed(0)}%)`);
  }

  if (parsed.keyUri) {
    const keyUrl = resolveSegmentUrl(parsed.keyUri, top.url);
    if (!keyUrl) {
      record(`${label} · AES key`, "FAIL", "key URI failed https resolution");
    } else {
      try {
        const key = await downloadBytes(keyUrl, headers);
        record(`${label} · AES key`, key.status >= 200 && key.status < 300 && key.bytes === 16 ? "PASS" : "FAIL",
          `key fetch ${key.status}, ${key.bytes} bytes (expect 16)`);
      } catch (cause) {
        record(`${label} · AES key`, "FAIL", String(cause instanceof Error ? cause.message : cause));
      }
    }
  }

  // Full rewrite + integrity gate over the REAL playlist (virtual file map —
  // the bytes' existence is the Kotlin service's job; the URI mapping and the
  // all-or-nothing rewrite are validated against the real manifest here).
  const map = new Map<string, string>();
  let unmappable = 0;
  for (const segment of parsed.segments) {
    const absolute = resolveSegmentUrl(segment.uri, top.url);
    if (!absolute) { unmappable += 1; continue; }
    map.set(absolute, `file://${BUNDLE_DIR}/seg-${String(map.size).padStart(5, "0")}.ts`);
  }
  if (parsed.keyUri) {
    const absoluteKey = resolveSegmentUrl(parsed.keyUri, top.url);
    if (absoluteKey) map.set(absoluteKey, `file://${BUNDLE_DIR}/key.bin`);
  }
  const rewritten = rewritePlaylistUris(playlistText, { baseUrl: top.url, mapUri: (url) => map.get(url) ?? null });
  record(`${label} · rewrite`, rewritten && unmappable === 0 ? "PASS" : "FAIL",
    rewritten ? `all ${parsed.segments.length} URIs + ${parsed.keyUri ? 1 : 0} keys rewritten to file://` : `rewrite refused (${unmappable} unmappable URIs)`);
  if (rewritten) {
    const virtualExists = (uri: string) => uri.startsWith("file://");
    record(`${label} · integrity`, verifyPlaylistIntegrity(rewritten, virtualExists) ? "PASS" : "FAIL",
      "verifyPlaylistIntegrity on the rewritten real manifest");
  }
}

async function e2eProgressiveSource(label: string, classified: ReturnType<typeof classify>) {
  const { unwrapped, headers } = classified;
  if (!/^https:\/\//i.test(unwrapped)) {
    record(`${label} · progressive`, "REFUSED", "non-https direct URL — correctly refused");
    return;
  }
  try {
    const head = await fetchWithTimeout(unwrapped, { method: "HEAD", headers });
    const length = Number(head.headers.get("content-length"));
    record(`${label} · HEAD preflight`, head.ok ? "PASS" : "FAIL",
      head.ok ? `${head.status}${Number.isFinite(length) && length > 0 ? `, ${(length / 1024 / 1024).toFixed(1)} MB (preflight ×1.15 = ${((length * 1.15) / 1024 / 1024).toFixed(1)} MB budget)` : ", no content-length (fail-open)"} ` : `HEAD ${head.status}`);
    // First-byte proof with the playback headers (Range keeps it cheap).
    const range = await fetchWithTimeout(unwrapped, { headers: { ...headers, Range: "bytes=0-65535" } });
    const body = range.ok ? await range.arrayBuffer() : new ArrayBuffer(0);
    record(`${label} · ranged fetch`, (range.status === 206 || (range.ok && body.byteLength > 0)) ? "PASS" : "FAIL",
      `${range.status}, ${(body.byteLength / 1024).toFixed(0)} KB with provider headers`);
  } catch (cause) {
    record(`${label} · progressive`, "FAIL", String(cause instanceof Error ? cause.message : cause));
  }
}

/** Public-CDN mode: run the full HLS pipeline against known real streams. */
async function runPublicMode() {
  console.log("═══ Aniraku offline-download E2E — public real-CDN streams ══\n");
  for (const target of PUBLIC_HLS_TARGETS) {
    console.log(`\n── ${target.label} ──   (${target.note})`);
    const classified = classify({ url: target.url, type: "hls", quality: "Auto" } as unknown as StreamSource);
    await e2eHlsSource(target.label, classified, { skipProxyRegression: true });
  }
  finish();
}

function finish() {
  console.log(`\n═══ RESULT: ${passCount} pass · ${failCount} fail · ${findings.filter((f) => f.verdict === "REFUSED").length} refused · ${findings.filter((f) => f.verdict === "SKIP").length} skipped ══`);
  process.exit(failCount > 0 && passCount === 0 ? 1 : 0);
}

async function main() {
  if (process.argv.includes("--public")) {
    await runPublicMode();
    return;
  }
  console.log("═══ Aniraku offline-download E2E — real network ══\n");

  // 1. Backend health
  try {
    const health = await healthCheck();
    console.log(`✓ backend health: ${JSON.stringify(health)}\n`);
  } catch (cause) {
    console.log(`✗ backend health FAILED: ${cause instanceof Error ? cause.message : cause}\n`);
  }

  // 2. Trending anime from the AniList mirror (same source the app uses).
  const trendingQuery = await fetchWithTimeout("https://graphql.aniraku.tech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "query { Page(page:1, perPage:6) { trending animeId:media(type:ANIME, sort:TRENDING_DESC) { id title { romaji } } } }" }),
  });
  const trendingPayload = (await trendingQuery.json()) as {
    data?: { Page?: { animeId?: Array<{ id: number; title?: { romaji?: string } }> } };
  };
  const animeIds: Array<{ id: number; title?: { romaji?: string } }> = (trendingPayload.data?.Page?.animeId ?? []).slice(0, ANIME_TO_TRY);
  if (!animeIds.length) {
    console.log("✗ trending lookup failed — cannot pick live targets");
    process.exit(1);
  }
  console.log(`targets: ${animeIds.map((a) => `${a.title?.romaji ?? a.id} (#${a.id})`).join(" · ")}\n`);

  for (const target of animeIds) {
    const meta = await getAnimeMetadata(target.id).catch(() => null);
    const title = meta?.title?.english || meta?.title?.romaji || target.title?.romaji || `#${target.id}`;
    console.log(`\n── ${title} (AniList ${target.id}) ──`);
    const episodes = await getEpisodes(target.id).catch(() => []);
    if (!episodes.length) { record(`${title}`, "SKIP", "no episodes available"); continue; }
    const episode = episodes[0].number;
    const servers = await getServers(target.id, episode, "sub");
    if (!servers.length) { record(`${title} EP${episode}`, "SKIP", "no servers for sub"); continue; }

    for (const server of servers.slice(0, SERVERS_PER_ANIME)) {
      const stream = await getStream({ animeId: target.id, episode, provider: server.provider, lang: "sub" }).catch(() => null);
      const sources = (stream?.sources ?? []) as StreamSource[];
      if (!sources.length) { record(`${title} · ${server.label}`, "SKIP", "stream resolved no sources"); continue; }

      for (const source of sources.slice(0, SOURCES_PER_SERVER)) {
        const label = `${title} · ${server.label}`;
        const classified = classify(source);
        if (classified.dead) { record(label, "REFUSED", "verification=dead — download gate refuses"); continue; }
        if (classified.embed) { record(label, "REFUSED", "embed source — download gate refuses"); continue; }
        if (classified.authBearing) { record(label, "REFUSED", "Authorization-bearing headers — threat-model refusal"); continue; }
        if (!classified.httpsDirect) { record(label, "REFUSED", "direct URL is not https after unwrap"); continue; }
        if (classified.isHls) await e2eHlsSource(label, classified);
        else await e2eProgressiveSource(label, classified);
      }
    }
  }

  finish();
}

main().catch((cause) => {
  console.error("harness crashed:", cause);
  process.exit(1);
});
