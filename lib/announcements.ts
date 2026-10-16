// Shared announcement model for the in-app banner.
// Single source of truth is site/announcements.json — the same file the website
// reads. It lives on GitHub (raw), NOT on the streaming backend, so the app can
// show and update announcements without shipping a new Android release and even
// when the backend itself is strained.

export const ANNOUNCEMENTS_RAW_URL =
  "https://raw.githubusercontent.com/Aniraku/Aniraku-App/main/site/announcements.json";

export type Announcement = {
  id: string;
  title: string;
  tag?: string;
  banner?: string;
  body?: string[];
  date?: string;
  ctaLabel?: string;
  ctaWeb?: string;
  ctaApp?: string;
  email?: string;
  emailLabel?: string;
  pinned?: boolean;
  active?: boolean;
};

const asString = (value: unknown) => (typeof value === "string" ? value : undefined);

/** Validates + normalizes the JSON. Never throws — bad entries are dropped. */
export function parseAnnouncements(raw: unknown): Announcement[] {
  const data = raw as { announcements?: unknown } | null | undefined;
  if (!data || !Array.isArray(data.announcements)) return [];

  return data.announcements
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
    .filter((entry) => entry.active !== false && typeof entry.id === "string" && typeof entry.title === "string")
    .map((entry) => ({
      id: String(entry.id),
      title: String(entry.title),
      tag: asString(entry.tag),
      banner: asString(entry.banner),
      body: Array.isArray(entry.body)
        ? entry.body.filter((paragraph): paragraph is string => typeof paragraph === "string")
        : undefined,
      date: asString(entry.date),
      ctaLabel: asString(entry.ctaLabel),
      ctaWeb: asString(entry.ctaWeb),
      ctaApp: asString(entry.ctaApp),
      email: asString(entry.email),
      emailLabel: asString(entry.emailLabel),
      pinned: entry.pinned === true,
      active: true,
    }));
}

/** Pinned first, then newest by ISO date. */
export function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => {
    const pin = Number(!!b.pinned) - Number(!!a.pinned);
    if (pin) return pin;
    return String(b.date || "").localeCompare(String(a.date || ""));
  });
}

/** The single announcement that should surface in the top in-app prompt. */
export function selectBannerAnnouncement(list: Announcement[]): Announcement | null {
  return sortAnnouncements(list).find((entry) => entry.pinned) ?? null;
}

/**
 * Show the prompt only when there is an announcement and this id has not been
 * dismissed. Dismissal is keyed by id, so a newer announcement shows again.
 */
export function shouldShowAnnouncement({
  announcement,
  dismissedId,
}: {
  announcement: Announcement | null | undefined;
  dismissedId?: string | null;
}): boolean {
  if (!announcement) return false;
  if (!dismissedId) return true;
  return dismissedId !== announcement.id;
}

export async function fetchAnnouncements(
  url: string = ANNOUNCEMENTS_RAW_URL,
  timeoutMs = 8000,
): Promise<Announcement[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`announcement fetch failed: ${res.status}`);
    const json: unknown = await res.json();
    return parseAnnouncements(json);
  } finally {
    clearTimeout(timer);
  }
}
