# Anime GIF picker integration

The comment and reply composers use the public [OtakuGIFs API](https://otakugifs.xyz/api), the verified browser-compatible anime reaction source for Aniraku’s frontend-only architecture. It requires no user login, API key, or backend proxy.

| Endpoint | Purpose | Picker behavior |
| --- | --- | --- |
| `GET https://api.otakugifs.xyz/gif/allreactions` | Returns the live reaction catalogue. | Populates about 70 searchable anime reaction categories, including `hug`, `laugh`, `headbang`, `facepalm`, `wink`, `cuddle`, and `thumbsup`. |
| `GET https://api.otakugifs.xyz/gif?reaction={reaction}&format=GIF` | Returns a selected animated reaction. | Supplies lazy tile previews and the GIF added to a comment or reply. |

The picker shows eighteen useful reactions by default, searches the broader live catalogue, caches successful GIF URLs for the active browser session, lazy-loads up to twenty-four visible previews at a time, and keeps accessible touch-safe buttons on smaller screens. If reaction-catalogue discovery is temporarily unavailable, the familiar featured actions remain available as a fallback.

The provider was tested from Aniraku’s own browser preview origin. The catalogue returned HTTP 200 and the `hug` request returned a valid animated CDN URL. A prior Gifukai attempt was removed because it failed cross-origin from Aniraku’s browser origin despite responding from its documentation domain. The picker intentionally does not claim to provide every anime title or character search: no verified no-key, frontend-only provider offers that capability reliably.
