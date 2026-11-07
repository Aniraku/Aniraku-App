/**
 * Canonical Aniraku website URLs — single source of truth for every link the
 * app shares or opens in a browser. The site's routes are /info/{id}
 * (details) and /watch/{id}[/{slug}] (player); the historical /anime/{id}
 * path no longer exists on the website.
 *
 * These https URLs double as Android App Links: aniraku.tech serves
 * /.well-known/assetlinks.json for the app's signing cert, and the app's
 * intent filters (app.config.ts) claim the /info/ and /watch/ prefixes — so
 * a shared link opens the app directly on installs that have it, and the
 * website for everyone else.
 */

export const ANIRAKU_SITE_ORIGIN = "https://aniraku.tech";

/** Details page for an anime (the link the share button publishes). */
export function animeInfoWebUrl(id: number | string): string {
  return `${ANIRAKU_SITE_ORIGIN}/info/${id}`;
}

/** Player page for an episode; ?ep= mirrors the website's own link shape. */
export function animeWatchWebUrl(id: number | string, episode?: number | null): string {
  const ep = Number.isFinite(episode) && Number(episode) > 0 ? `?ep=${Math.floor(Number(episode))}` : "";
  return `${ANIRAKU_SITE_ORIGIN}/watch/${id}${ep}`;
}
