# Test Phase Findings

Date: 2026-03-11

## Scope reviewed

Scenes reviewed:
- `clocktower`
- `binaryExternal`
- `binarySurface`

Validation used:
- `npm run headless:matrix`
- `npm run headless:lighting`
- `npm run headless:clocktower-lighting`
- `npm run headless:latitude`
- `npm run headless:ui`
- manual screenshot review of desktop and mobile outputs in `output/`

## Findings

### Fixed

1. `binaryExternal` was still inheriting day/night presentation from the planetary lighting state
- Symptom:
  - `external-wide` could render with a warm daylight wash instead of a stable deep-space backdrop
- Root cause:
  - external background/fog were being driven from the same atmosphere-derived colors used for the surface scene
- Fix:
  - external background and fog were decoupled from surface day/night state
  - external starfield scale was increased slightly for readability
- Validation:
  - `npm run headless:matrix`
  - `npm run headless:ui`
  - external background/fog invariance now checked across multiple hours in the UI regression

2. `surface-noon` preset produced an unusable sky-only composition
- Symptom:
  - the high-day preset often showed almost no ocean/horizon, so the scene stopped reading as a planetary surface
- Root cause:
  - preset camera state forced an aggressively upward composition and cinematic tracking kept the sun centered
- Fix:
  - `surface-noon` now starts in a stable non-cinematic horizon composition with a flatter pitch
- Validation:
  - `npm run headless:lighting`
  - updated `lighting-noon-page.png` shows a stable sky/ocean composition

3. `surface-night` preset underframed the horizon and made the ocean harder to read than necessary
- Symptom:
  - night view was technically valid but too downward-biased to function as a good default composition
- Root cause:
  - preset pitch was implicitly derived from below-horizon star direction
- Fix:
  - `surface-night` now uses an explicit flatter pitch for a clearer horizon/ocean read
- Validation:
  - `npm run headless:lighting`
  - updated `lighting-night-page.png` shows a more stable horizon composition

4. URL deep-link restoration did not preserve cinematic mode reliably
- Symptom:
  - `cinematic=1` in the URL could be dropped during boot/scene restoration
- Root cause:
  - scene activation forcibly reset cinematic state before preset restoration completed
- Fix:
  - scene activation no longer unconditionally clears cinematic mode
  - mode text now refreshes from the current cinematic state after scene changes
- Validation:
  - `npm run headless:ui`
  - deep-link + reload now preserve scene, preset, lat/lon, multiplier, and cinematic flag

5. Mobile surface schematics overlapped each other in portrait layout
- Symptom:
  - the upper-left planet inset and upper-right orbital schematic intersected on narrow screens
- Root cause:
  - the generic tablet breakpoint sizes were too large for 390px portrait width
- Fix:
  - added a tighter `max-width: 600px` layout for both schematics and HUD spacing
- Validation:
  - `npm run headless:ui`
  - mobile regression now asserts the two schematics do not overlap

6. Mobile clocktower framing was too tight and could produce a bright off-edge glare strip
- Symptom:
  - portrait clocktower render clipped bright content at the left edge and framed the tower too tightly
- Root cause:
  - portrait view reused desktop-ish camera distance/FOV
- Fix:
  - portrait clocktower now uses a farther camera position and a portrait-aware FOV
- Validation:
  - `npm run headless:ui`
  - updated `mobile-clocktower-page.png` is now stable and readable

### Reviewed but not blocking

1. `clocktower` default section remains intentionally hot in the beacon core
- This is visually aggressive, but it reads as authored rather than broken after the portrait framing fix.

2. `binarySurface` night remains dark by design
- The new default composition is readable enough for sign-off.
- Further night-surface rendering improvements belong in the next rendering phase rather than the test phase.

## Test-phase sign-off

Sign-off criteria from `docs/test-phase-plan.md` are satisfied:
- known correctness bugs found during review were reproduced and fixed
- critical UI inconsistencies found during review were resolved
- every scene now has a stable default composition on desktop and mobile
- full headless suite passes, including the new UI/mobile/URL regression
- manual screenshot review shows no blocking clipped view, broken control, or unreadable default scene state

## Commands used for final sign-off

```bash
npm run headless:matrix
npm run headless:lighting
npm run headless:clocktower-lighting
npm run headless:latitude
npm run headless:ui
```

Or all at once:

```bash
npm run headless:test-phase
```
