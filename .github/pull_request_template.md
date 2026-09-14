## What changed

- 
- 

## Track-0 de-slop checklist

- [ ] No `fontFamily: "monospace"` outside timestamps, episode numbers, counts, source names
- [ ] No text below 10px; body text 12–14px; titles are display / section / utility scale only
- [ ] No `letterSpacing` above ±1 outside the red utility labels
- [ ] One accent per view: signal red `#FF4D4D` marks one active intent, never a field of badges/dots
- [ ] No icon soup: Phosphor only, one weight per surface, consistent size per row (18 top bars, 20–24 rails)
- [ ] Touch targets ≥ 30px + hitSlop; rails ≥ 32px
- [ ] Space and rules instead of bordered boxes; corners 4–8px (12px only for media crops); no pill-everything
- [ ] No loading theater: no spinners where a 120–180ms opacity swap works; no fake progress bars
- [ ] No decorative animation; motion only connects cause → effect
- [ ] Copy is terse: a button never narrates what it already says
- [ ] No AI-slop words in UI copy: no "delve", "elevate", "seamless", "vibrant", "unleash", "embark", "Oops", "!"-led hype
- [ ] No emoji in UI. No gradient text. No glassmorphism panels over artwork.
- [ ] No nested bordered cards. No card inside a card. No section header that repeats content.
- [ ] One primary action per view. Everything else is text, quiet icon, or 1px control.
- [ ] Grep check run: `grep -n "monospace\|letterSpacing: [2-9]\|fontSize: [0-9][,}]" app/ components/` — nothing outside the rules above

## Screenshots (required for any `app/` route change)

- [ ] Before/after screenshots attached to the PR (stored in the PR, not the repo)
- [ ] N/A — no `app/` route changed

## Verification

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` green (or touched subset listed below):
- [ ] Zero-dead-button pass: every player control, sheet row, and empty-state action tapped once on device (release PRs)
