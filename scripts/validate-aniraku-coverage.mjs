const apiBase = process.env.ANIRAKU_API_BASE || "https://api.aniraku.tech";
const animeId = Number(process.argv[2] || "16498");
const concurrency = 4;

async function request(path) {
  const response = await fetch(`${apiBase}${path}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json();
}

function providersFor(payload) {
  if (!Array.isArray(payload)) return [];
  return payload.filter((server) => {
    const sources = Array.isArray(server?.sources) ? server.sources : [];
    return sources.some((source) => source?.url && String(source?.verification ?? source?.Verification ?? "").toLowerCase() !== "dead");
  }).map((server) => String(server?.name || server?.label || server?.provider || "unknown"));
}

async function runPool(items, task) {
  const output = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      output.push(await task(item));
    }
  });
  await Promise.all(workers);
  return output.sort((a, b) => a.episode - b.episode || a.language.localeCompare(b.language));
}

const rawEpisodes = await request(`/api/v1/anime/${animeId}/episodes`);
const episodes = (Array.isArray(rawEpisodes) ? rawEpisodes : rawEpisodes?.episodes || []).filter(Boolean).map((_, index) => index + 1);
if (!episodes.length) throw new Error(`No canonical episodes returned for anime ${animeId}`);

const checks = await runPool(episodes.flatMap((episode) => ["sub", "dub"].map((language) => ({ episode, language }))), async ({ episode, language }) => {
  try {
    const payload = await request(`/api/v1/servers?animeId=${animeId}&episode=${episode}&lang=${language}`);
    const providers = providersFor(payload);
    return { episode, language, playable: providers.length > 0, providers };
  } catch (error) {
    return { episode, language, playable: false, providers: [], error: String(error?.message || error) };
  }
});

const byLanguage = Object.fromEntries(["sub", "dub"].map((language) => {
  const rows = checks.filter((item) => item.language === language);
  const playable = rows.filter((item) => item.playable);
  const unavailable = rows.filter((item) => !item.playable).map((item) => item.episode);
  return [language, { canonicalEpisodes: episodes.length, playableEpisodes: playable.length, unavailableEpisodes: unavailable, providerSamples: playable.slice(0, 3).map((item) => ({ episode: item.episode, providers: item.providers })) }];
}));

console.log(JSON.stringify({ animeId, episodeRange: [episodes[0], episodes.at(-1)], byLanguage }, null, 2));
