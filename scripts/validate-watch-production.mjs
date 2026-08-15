const apiBase = process.env.ANIRAKU_API_BASE || "https://api.aniraku.tech";
const sampleIds = (process.env.ANIRAKU_SAMPLE_IDS || "16498,101922,113415")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter(Number.isFinite);

const timeout = (ms) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, dispose: () => clearTimeout(timer) };
};

async function requestJson(path, init = {}, timeoutMs = 50_000) {
  const guard = timeout(timeoutMs);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      signal: guard.signal,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${response.status} ${path}: ${body.slice(0, 160)}`);
    return body ? JSON.parse(body) : {};
  } finally {
    guard.dispose();
  }
}

function verification(source) {
  return String(source?.verification ?? source?.Verification ?? "").toLowerCase();
}

function playbackType(source) {
  const raw = `${source?.type ?? ""} ${source?.mime ?? ""}`.toLowerCase();
  const url = String(source?.url ?? "").toLowerCase();
  if (raw.includes("embed") || raw.includes("iframe") || raw.includes("page")) return "embed";
  if (raw.includes("dash") || /\.mpd(?:$|[?#])/.test(url)) return "dash";
  if (raw.includes("hls") || raw.includes("mpegurl") || /\.m3u8(?:$|[?#])/.test(url)) return "hls";
  return "native";
}

function visibleProvider(server) {
  const sources = Array.isArray(server?.sources) ? server.sources : [];
  return sources.some((source) => source?.url && verification(source) !== "dead");
}

async function proxyProbe(source, headers) {
  const parameters = new URLSearchParams({ url: source.url, rn: `production-probe-${Date.now()}` });
  if (headers && Object.keys(headers).length) parameters.set("headers", JSON.stringify(headers));
  const guard = timeout(35_000);
  try {
    const response = await fetch(`${apiBase}/api/v1/proxy?${parameters.toString()}`, {
      headers: { Range: "bytes=0-1023" },
      signal: guard.signal,
    });
    const contentType = response.headers.get("content-type") || "unknown";
    const reader = response.body?.getReader();
    if (reader) {
      await reader.read();
      await reader.cancel();
    }
    return { ok: response.ok, status: response.status, contentType };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    guard.dispose();
  }
}

async function embedProbe(source) {
  const guard = timeout(30_000);
  try {
    const response = await fetch(source.url, {
      method: "GET",
      headers: { Range: "bytes=0-1023", "User-Agent": "Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36" },
      signal: guard.signal,
      redirect: "follow",
    });
    const reader = response.body?.getReader();
    if (reader) {
      await reader.read();
      await reader.cancel();
    }
    return { ok: response.ok, status: response.status, contentType: response.headers.get("content-type") || "unknown" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    guard.dispose();
  }
}

async function probeLanguage(animeId, episode, language) {
  const servers = await requestJson(`/api/v1/servers?animeId=${animeId}&episode=${episode}&lang=${language}`);
  const visible = Array.isArray(servers) ? servers.filter(visibleProvider) : [];
  if (!visible.length) return { language, serverCount: 0, resolution: null, proxy: null, embed: null };

  const server = visible[0];
  const provider = server.name || server.provider || server.label;
  const stream = await requestJson("/api/v1/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ animeId, episode, provider, lang: language, quality: "auto", refresh: false }),
  });
  const sources = Array.isArray(stream.sources) ? stream.sources.filter((source) => source?.url && verification(source) !== "dead") : [];
  const direct = sources.find((source) => playbackType(source) !== "embed");
  const embed = sources.find((source) => playbackType(source) === "embed" && verification(source) === "embed");
  return {
    language,
    serverCount: visible.length,
    provider: String(provider),
    resolution: { sourceCount: sources.length, directType: direct ? playbackType(direct) : null, hasVerifiedEmbed: Boolean(embed) },
    proxy: direct ? await proxyProbe(direct, stream.headers ?? server.headers) : null,
    embed: embed ? await embedProbe(embed) : null,
  };
}

const results = [];
for (const animeId of sampleIds) {
  try {
    const episodesPayload = await requestJson(`/api/v1/anime/${animeId}/episodes`);
    const episodes = (Array.isArray(episodesPayload) ? episodesPayload : episodesPayload?.episodes ?? []).filter(Boolean);
    const episode = episodes.length ? 1 : null;
    if (!episode) throw new Error("No canonical episodes");
    const languages = [];
    for (const language of ["sub", "dub"]) {
      try {
        languages.push(await probeLanguage(animeId, episode, language));
      } catch (error) {
        languages.push({ language, error: error instanceof Error ? error.message : String(error) });
      }
    }
    results.push({ animeId, episode, languages });
  } catch (error) {
    results.push({ animeId, error: error instanceof Error ? error.message : String(error) });
  }
}

const summary = {
  sampledTitles: results.length,
  languageChecks: results.flatMap((result) => result.languages ?? []).length,
  proxySuccesses: results.flatMap((result) => result.languages ?? []).filter((result) => result.proxy?.ok).length,
  verifiedEmbedsReachable: results.flatMap((result) => result.languages ?? []).filter((result) => result.embed?.ok).length,
};

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), apiBase, summary, results }, null, 2));
