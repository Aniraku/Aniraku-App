const en = {
  "player.retry": "Try again",
  "player.switchServer": "Switch server",
  "player.copyError": "Copy error",
  "player.quality": "Quality",
  "player.speed": "Speed",
  "player.playbackSpeed": "Playback Speed",
  "player.subtitles": "Subtitles",
  "player.subtitleSize": "Subtitle size",
  "player.audio": "Audio",
  "player.sleepTimer": "Sleep timer",
  "player.chapters": "Chapters",
  "player.selectServer": "Select Server",
  "player.close": "Close",
  "player.resume": "Resume",
  "player.skipIntro": "Skip Intro",
  "player.skipOutro": "Skip Outro",
  "player.listOfEpisodes": "List of episodes",
  "player.searchEpisodes": "No. of Ep",
  "player.rateEpisode": "Rate this episode",
  "player.youRated": "You rated",
  "player.noTracks": "No tracks for this source",
  "player.nothingSelectable": "Nothing selectable",
  "player.off": "Off",
  "player.cancel": "Cancel",
  "settings.title": "Settings",
  "settings.accountRequired": "Account required",
  "settings.openingAccount": "Opening account controls",
  "settings.application": "Application",
  "settings.notifications": "Notifications",
  "settings.newEpisodes": "New Episode Alerts",
  "settings.newEpisodesDetail": "Notifies when subscribed anime gets new episodes",
  "settings.commentReplies": "Comment Replies",
  "settings.commentRepliesDetail": "Notifies when someone replies to your comment",
  "settings.systemAnnouncements": "System Announcements",
  "settings.systemAnnouncementsDetail": "App updates and maintenance notices",
  "settings.librarySync": "Library sync",
  "settings.yourLists": "Your connected lists",
  "settings.syncedLibrary": "Synced library",
  "settings.supportLegal": "Support and legal",
  "settings.signOut": "Sign out",
  "settings.check": "Check",
  "settings.checking": "Checking",
  "settings.refresh": "Refresh",
  "settings.import": "Import",
  "settings.export": "Export",
  "settings.disconnect": "Disconnect",
  "settings.content": "Content",
  "settings.nsfwContent": "NSFW content",
  "settings.nsfwContentDetail": "Show hentai and adult anime in browse, search, and random",
  "settings.nsfwWarning": "When enabled, adult and hentai titles may appear in your catalog, search results, and recommendations.",
  "settings.nsfwAgeTitle": "Confirm your age",
  "settings.nsfwAgeMessage": "Adult and hentai titles are only for viewers aged 18 or older. Confirm you meet the age requirement to show this content.",
  "settings.nsfwAgeConfirm": "I am 18 or older",
  "settings.nsfwAgeDecline": "Not now",
} as const;

export type I18nKey = keyof typeof en;
export type Locale = "en";

const dictionaries: Record<Locale, Record<string, string>> = { en: { ...en } };
let activeLocale: Locale = "en";

export function setLocale(locale: Locale) {
  activeLocale = locale;
}

export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[activeLocale][key] ?? dictionaries.en[key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

export function isI18nKey(value: string): value is I18nKey {
  return value in en;
}
