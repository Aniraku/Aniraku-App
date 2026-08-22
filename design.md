# Handcrafted Editorial Design Direction

## The correction

The previous direction treated **Nothing OS** as a collection of dark rounded cards, monospaced labels, and status chips. That reads as generated theming, not authorship. It is rejected.

The new direction is **Aniraku Afterimage**: a cinematic, editorial anime library built in a calm monochrome shell. Full-color anime art creates emotion; white typography establishes a clear reading order; a single restrained signal-red accent marks active intent. The interface has fewer visual containers, less explanatory copy, less ornamental technical language, and more decisive composition.

## Editorial rules

| Decision | Rule |
|---|---|
| Hierarchy | Each screen has one visual event, one clear next action, and quiet supporting content. The eye should not have to decode a sequence of similarly weighted cards. |
| Artwork | Anime artwork is cropped with intent: a backdrop may bleed to the edge; a poster may sit partially outside its information field; a small still is used only when it advances selection. Never use artwork as a tiny thumbnail inside an unnecessarily heavy card. |
| Type | A title is either display-scale, section-scale, or utility-scale. The UI must not create a fourth, fifth, and sixth arbitrary emphasis level. Utility text is concise and almost never narrates what a control already says. |
| Surfaces | Base black is the canvas. A raised surface exists only when it separates a decision, a tool, or an input. Most sections use space, rules, or image crops rather than bordered containers. |
| Shape | Use near-square 4–8 px corners for controls and 12 px only where a media crop needs it. Avoid uniformly pill-shaped and 16–24 px rounded containers. |
| Accent | Signal red `#FF4D4D` marks playback, selected navigation, active actions, and destructive transitions. Health remains readable through copy and structure, not a field of green dots. |
| Navigation | The navigation dock is quiet and integrated. The active destination gains a red indicator and stronger label; inactive items recede without a border or separate card. |
| Motion | There is no ornamental loading theater. 120–180 ms opacity, crop, and press changes are used only to connect cause and effect. |

## Screen compositions

| Screen | Handcrafted composition |
|---|---|
| Home | A single edge-to-edge “continue / discover” image event with a concise overlay; followed by a vertically paced editorial list. The first released title may be wide, the next two may be compact, and the catalog action is a simple text-led link. |
| Catalog | A deliberate poster gallery, not a grid trapped in equal cells. Posters use varied vertical rhythm, minimal overlay copy, and a small red active sort line. Search becomes a temporary top field, not a permanent large form. |
| Schedule | A real time-led list. Times become the visual anchor on the left; an image strip and title live on the right. Day labels are large enough to scan without another card. |
| Random | One poster, one fact line, one action. It should feel like an album sleeve or a festival poster, not a dashboard. |
| Anime detail | A backdrop creates atmosphere, then a crisp poster/title pairing leads into a simple action bar. Episode rows use real source thumbnails and progress but retain a list rhythm—not a series of boxed controls. |
| Watch | The media plane is dominant. The overlay is quiet: rewind, play, forward, and one menu affordance. The source console is a bottom tool surface that appears on demand and never competes with the artwork or video. |
| Library and profile | Content, not account explainers, fills the screen. A signed-out state is a calm welcome with one action; a signed-in state prioritizes resume rows, saved art, and useful counts. |
| Search and settings | Search is blank, focused, and typographic. Settings is a precise grouped list with rules and leading icons, not a stack of cards. |

## Component limits

| Component | Allowed use |
|---|---|
| Red dot / line | Active tab, active playback, currently selected sort, destructive acknowledgement, and no more than one focal state per view. |
| Monospace utility label | Timestamp, episode number, source name, compact filter, or a factual count. Never use it as a heading decoration on every section. |
| Raised panel | Input, player console, destructive confirmation, or a compact status recovery path. |
| Border | Thin dividing rule or interactive control outline. A bordered card may not be nested inside a bordered card. |
| Primary button | One decisive action in a view. Secondary actions should use text, a quiet icon, or a 1 px control. |

## Acceptance bar

The rebuilt app must look like it was art-directed by a human who understands anime editorial media, not like a component library wearing a dark theme. A reviewer should be able to identify the current screen’s intended first focal point within one second, distinguish sections without reading labels, and operate core actions without decoding decorative system language. All compositions still retain 48 dp touch targets, readable contrast, real AniList art, and real Aniraku backend states.

## Validation note

Live preview validation confirmed the new Home surface renders real AniList artwork with one dominant full-bleed title event, a quieter “start here” transition, compact poster-led release rails, and a restrained red active navigation state. The approach replaces the rejected repeated-card composition without changing discovery data or navigation behavior.

## Reference rationale

The redesign applies visual hierarchy through controlled scale, spacing, value, and asymmetric balance rather than through repeated card decoration. It uses the Nothing-inspired principle of purposeful, clear controls without treating typographic utility cues as the product identity.
---

[README](./README.md) · [Contributing](./CONTRIBUTING.md)
