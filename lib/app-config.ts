const productionAnirakuApi = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://api.aniraku.tech";

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
  episodeFallbackBaseUrl: process.env.EXPO_PUBLIC_EPISODE_FALLBACK_URL ?? "https://miruro-api-v3.onrender.com",
  anilistGraphqlUrl: process.env.EXPO_PUBLIC_ANILIST_GRAPHQL_URL ?? "https://graphql.anilist.co",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  giphyApiKey: process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? "",
  deepLinkScheme: "aniraku",
} as const;

export function requirePublicConfig(value: string, name: string) {
  if (!value) throw new Error(`${name} is not configured in this build.`);
  return value;
}
