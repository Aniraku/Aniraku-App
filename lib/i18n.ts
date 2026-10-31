const en = {
  "player.retry": "Try again",
  "player.switchServer": "Switch server",
  "player.copyError": "Copy error",
  "player.quality": "Quality",
  "player.playbackSpeed": "Playback Speed",
  "player.subtitles": "Subtitles",
  "player.subtitleSize": "Subtitle size",
  "player.chapters": "Chapters",
  "player.selectServer": "Select Server",
  "player.listOfEpisodes": "List of episodes",
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
  "nsfw.lockTitle": "18+ content",
  "nsfw.lockBody": "This title is marked 18+. Turn on NSFW in Settings (age confirmation required) to show it.",
  "nsfw.lockSettings": "Open Settings",
} as const;

export type I18nKey = keyof typeof en;

const dictionary: Record<string, string> = { ...en };

export function t(key: I18nKey, vars?: Record<string, string | number>): string {
  const template = dictionary[key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce(
    (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
