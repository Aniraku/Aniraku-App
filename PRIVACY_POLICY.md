# Privacy Policy

Last updated August 2026.

We run Aniraku at [aniraku.vercel.app](https://aniraku.vercel.app). Here's what happens with your data.

## What we collect

If you make an account:

- Your email (handled by Supabase — we never see your password)
- A username, and whatever optional profile info you add (display name, bio, avatar)

As you use the site while signed in:

- Watch history and progress (which anime, which episode, how far in)
- Bookmarks you save (anime title and cover image, so they can appear on other devices)
- Comments and likes you post
- Your settings, including the NSFW content preference for your account

If you browse without an account, everything stays on your device (localStorage): watch history, bookmarks, and the NSFW preference. None of it is sent to our servers.

## What we don't

- No analytics, no tracking cookies, no ad networks on our own pages.
- Your data isn't sold to anyone, shared with advertisers, or used to build profiles about you.
- We don't track you across other websites.

## Where stuff lives

- Account data, watch history, bookmarks, comments, likes and settings are stored in Supabase (hosted on AWS, encrypted at rest). Every request is scoped to your login — neither the app nor our backend ever sees anyone else's data, and row-level security prevents one account from reading another.
- Watch progress is also kept in your browser's localStorage, so it works even if you're offline or the backend is down.

## Third parties

- **AniList** — we fetch anime metadata (titles, artwork, descriptions, relations, schedule) from their public GraphQL API. Your search terms and the titles you open are sent to them.
- **Jikan / MyAnimeList** — used as a fallback for search results.
- **Miruro (video hosts)** — video streams are resolved by our backend and played through a proxy, so the upstream hosts don't see your IP address. These third-party hosts may display ads inside their players.
- **Supabase** — authentication and database. Your password never touches our servers.
- **Vercel** — hosts the frontend.
- **Render** — hosts the streaming backend. Like any web server, it records basic request metadata (IP address, user agent) in transient logs for rate limiting and abuse prevention; these are not used for tracking.

## How long we keep things

- Account data? Until you delete your account (Settings → Danger Zone → Delete Account). Deleting wipes your profile, watch history, bookmarks, comments, likes and settings — it cannot be undone.
- Watch history? Until you clear it (Profile → Clear History), which clears both the device copy and your account copy.
- Local browser data? Until you clear your site data in browser settings.

## If you're under 13

This site isn't meant for kids under 13, and we don't knowingly collect data from anyone that young. Some titles are marked mature (NSFW); they're hidden by default and only shown if an adult account enables them. If you think we accidentally have data from someone under 13, open a GitHub issue and we'll take care of it.

## Your rights

- See and correct your info anytime (Profile → Edit Profile)
- Delete your watch history (Profile → Clear History)
- Turn mature content off (Settings → Content)
- Delete your entire account and all associated data (Settings → Danger Zone)
- Delete local data anytime by clearing your browser's site data

## Changes

If we update this policy, we'll note it here. Using the site after changes means you're okay with them.

## Questions?

Open an issue on [GitHub](https://github.com/Aniraku/Aniraku/issues) or find us on [Discord](https://discord.gg/aniraku).
