# Headless Behavior Test Plan

Date: 2026-03-09

## Scope

Validate critical behaviors for:
- Clocktower scene controls
- Binary external scene readability + UI
- Binary surface POV physical consistency + schematic correctness
- Sun-track camera behavior

## Test Cases

1. `clocktower` hides time badge
- Command:
  - `node scripts/headless-render.mjs --scene=clocktower --name=test-clocktower --wait-ms=2200`
- Expected:
  - `#timeIndicator` not shown
  - camera mode text references clocktower section only

2. `binaryExternal` shows system-view badge and manual orbit camera label
- Command:
  - `node scripts/headless-render.mjs --scene=binaryExternal --hour=14 --hour-rate=0 --name=test-external-ui --wait-ms=2200`
- Expected:
  - time badge = `SYSTEM VIEW`
  - mode badge includes `Manual Orbit Camera // Binary External`

3. Schematic viewer vector follows camera smoothly (no 2-state flipping)
- Command:
  - Sweep azimuth:
  - `for a in 0 0.4 0.8 1.2 1.6 2.0 2.4 2.8 3.2 3.6 4.0 4.4 4.8 5.2 5.6 6.0; do node scripts/headless-render.mjs --scene=binarySurface --hour=14 --hour-rate=0 --azimuth=$a --polar=1.5 --distance=12.4 --target-x=0 --target-y=1.2 --target-z=-80 --name=test-viewer-$a --wait-ms=1200; done`
- Expected:
  - `schematic.viewerDir` changes continuously with azimuth
  - no abrupt sign flip into only two opposite vectors

4. Day/night invariant to viewer turn at fixed simulation time
- Command:
  - `node scripts/headless-render.mjs --scene=binarySurface --hour=12 --hour-rate=0 --azimuth=0 --polar=1.5 --distance=12.4 --target-x=0 --target-y=1.2 --target-z=-80 --name=test-daynight-a0 --wait-ms=1600`
  - `node scripts/headless-render.mjs --scene=binarySurface --hour=12 --hour-rate=0 --azimuth=3.1415926535 --polar=1.5 --distance=12.4 --target-x=0 --target-y=1.2 --target-z=-80 --name=test-daynight-a180 --wait-ms=1600`
  - `node scripts/headless-render.mjs --scene=binarySurface --hour=12 --hour-rate=0 --azimuth=6.283185307 --polar=1.5 --distance=12.4 --target-x=0 --target-y=1.2 --target-z=-80 --name=test-daynight-a360 --wait-ms=1600`
- Expected:
  - `schematic.viewerLightDot` unchanged (within tiny numeric tolerance)
  - time badge day/night label unchanged

5. Surface POV allows full 360+ rotation
- Command:
  - same as Case 4 including `azimuth=6.283185307` and `azimuth=9.42477796`
- Expected:
  - valid render at each azimuth
  - camera heading advances past 2pi (no clamp)

6. Sun-track camera rotates aim toward primary star without moving viewer position
- Command:
  - programmatic click of `#modeBadge` in binary surface scene and sample debug before/after
- Expected:
  - `cameraPos` remains effectively unchanged
  - `cameraTarget` changes over time in cinematic mode
  - mode badge text = `Sun-Track Camera // Planet POV`

## Results

1. Clocktower hides time badge: `PASS`
- Evidence (`/tmp/h1.log`):
  - `timeDisplay = "none"`
  - `timeVisible = false`
  - mode text = `Manual Camera // Pulse Forge`

2. External UI labels: `PASS`
- Evidence (`/tmp/h2.log`):
  - `timeText = "System View"`
  - mode text = `Manual Orbit Camera // Binary External`

3. Viewer vector smoothness: `PASS`
- Evidence (`/tmp/h3-summary.log`):
  - azimuth sweep `0 -> 6.0` shows continuous `schematic.viewerDir` progression around the unit circle.
  - no collapse into a two-direction flip.

4. Day/night invariant to turn: `PASS`
- Evidence (`/tmp/h4a.log`, `/tmp/h4b.log`, `/tmp/h4c.log`):
  - `schematic.viewerLightDot` remains `-0.9975689397536385` at azimuth `0`, `pi`, and `2pi`.
  - `time24` remains `12:00` and day/night classification stays unchanged.

5. 360+ rotation: `PASS`
- Evidence (`/tmp/h5.log`):
  - valid render at azimuth `9.42477796` (540 degrees) with normal debug output and screenshots.
  - no clamp/crash; rotation beyond `2pi` remains functional.

6. Sun-track aim-only behavior: `PASS`
- Evidence (`/tmp/h6.log`):
  - before mode: `Manual Horizon Camera // Planet POV`
  - after mode: `Sun-Track Camera // Planet POV`
  - `cameraPos` unchanged (`[0, 2.077, -67.631]` before and after)
  - `cameraTarget` updates over time (e.g. from `[0,1.2,-80]` to `[-0.881,1.698,-79.961]`)
