export const APP_CONFIG = {
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://api.aniraku.tech",
  anilistGraphqlUrl: process.env.EXPO_PUBLIC_ANILIST_GRAPHQL_URL ?? "https://graphql.anilist.co",
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  deepLinkScheme: "aniraku",
} as const;

export function requirePublicConfig(value: string, name: string) {
  if (!value) throw new Error(`${name} is not configured in this build.`);
  return value;
}
