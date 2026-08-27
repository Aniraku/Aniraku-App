const productionAnirakuApi = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://api.aniraku.tech";
const configuredMetadataResolverUrl = process.env.EXPO_PUBLIC_METADATA_RESOLVER_URL;
const metadataResolverUrl = configuredMetadataResolverUrl === undefined
  ? "https://www.aniraku.tech/api/mal"
  : configuredMetadataResolverUrl.startsWith("https://")
    ? configuredMetadataResolverUrl
    : "";
const configuredTmdbEpisodesResolverUrl = process.env.EXPO_PUBLIC_TMDB_EPISODE_RESOLVER_URL;
const tmdbEpisodesResolverUrl = configuredTmdbEpisodesResolverUrl === undefined
  ? "https://www.aniraku.tech/api/tmdb-episodes"
  : configuredTmdbEpisodesResolverUrl.startsWith("https://")
    ? configuredTmdbEpisodesResolverUrl
    : "";

function previewAnirakuProxy() {
  // Native Android has no browser window and always calls api.aniraku.tech
  // directly. Keep this module React-Native-import free because the test
  // runner evaluates it in Node before its native transform layer is present.
  // React Native defines a global window alias, but unlike a browser it has no
  // location object. Guard that distinction before Expo Router loads routes.
  const hostname = typeof window === "undefined" ? undefined : window.location?.hostname;
  if (!hostname) return null;
  if (!hostname.startsWith("8081-") || !hostname.endsWith(".manus.computer")) return null;
  return `https://${hostname.replace(/^8081-/, "3000-")}/api/aniraku`;
}

export const APP_CONFIG = {
  // Android uses the authoritative production backend directly. The temporary
  // browser preview uses a same-project forwarding route because api.aniraku.tech
  // deliberately restricts its browser CORS allow-list to trusted web origins.
  apiBaseUrl: previewAnirakuProxy() ?? productionAnirakuApi,
  anilistGraphqlUrl: process.env.EXPO_PUBLIC_ANILIST_GRAPHQL_URL ?? "https://graphql.anilist.co",
  metadataResolverUrl,
  // This public URL reaches the website's server-side TMDB resolver. It is not
  // a TMDB API URL and the TMDB read token never enters an Expo environment.
  tmdbEpisodesResolverUrl,
  metadataFallbackUrl: process.env.EXPO_PUBLIC_METADATA_FALLBACK_URL ?? "https://api.aniraku.tech/api/v1/anilist",
  directMalEnabled: process.env.EXPO_PUBLIC_DIRECT_MAL === "true" && Boolean(process.env.EXPO_PUBLIC_MAL_CLIENT_ID),
  malClientId: process.env.EXPO_PUBLIC_MAL_CLIENT_ID ?? "",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  giphyApiKey: process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? "",
  deepLinkScheme: "aniraku",
} as const;

export function requirePublicConfig(value: string, name: string) {
  if (!value) throw new Error(`${name} is not configured in this build.`);
  return value;
}
