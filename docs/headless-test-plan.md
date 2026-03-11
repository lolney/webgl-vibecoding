# Headless Behavior Test Plan

Date: 2026-03-09

## Scope

Validate critical behaviors for:
- Clocktower scene controls
- Binary external scene readability + UI
- Binary surface POV physical consistency + schematic correctness
- Binary surface lighting model and extinction behavior
- Sun-track camera behavior
- Shared preset/url reproducibility
- Headless debug sidecar output

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

7. Equatorial solar altitude follows a physical day arc
- Command:
  - `node scripts/headless-render.mjs --scene=binarySurface --hour=6 --hour-rate=0 --lat=0 --lon=0 --name=eq-h6 --wait-ms=1200`
  - `node scripts/headless-render.mjs --scene=binarySurface --hour=9 --hour-rate=0 --lat=0 --lon=0 --name=eq-h9 --wait-ms=1200`
  - `node scripts/headless-render.mjs --scene=binarySurface --hour=12 --hour-rate=0 --lat=0 --lon=0 --name=eq-h12 --wait-ms=1200`
  - `node scripts/headless-render.mjs --scene=binarySurface --hour=15 --hour-rate=0 --lat=0 --lon=0 --name=eq-h15 --wait-ms=1200`
  - `node scripts/headless-render.mjs --scene=binarySurface --hour=18 --hour-rate=0 --lat=0 --lon=0 --name=eq-h18 --wait-ms=1200`
- Expected:
  - primary solar altitude near horizon at sunrise/sunset
  - primary solar altitude high near local noon
  - progression is monotonic rising into noon and falling after noon

8. Accelerated time remains continuous through midnight
- Command:
  - Playwright sample loop in `binarySurface` starting near `23:42` with `binaryHourRate=0.4` and multiplier `16`
- Expected:
  - `binarySimulationDays` increases continuously past integer day boundaries
  - solar altitude changes smoothly
  - no orbital-state reset when `time24` wraps from `23:xx` to `00:xx`

9. Preset matrix remains reproducible
- Command:
  - `npm run headless:matrix`
- Expected:
  - each preset emits page/canvas/debug artifacts
  - preset-specific scene and mode labels match expected state

10. Debug JSON sidecar is emitted for headless runs
- Command:
  - `node scripts/headless-render.mjs --scene=binarySurface --preset=surface-sunrise --name=test-debug-dump`
- Expected:
  - `output/test-debug-dump-debug.json` exists
  - dump includes scene, preset, camera, time, and solar-altitude state

11. Lighting regression remains stable across canonical surface presets
- Command:
  - `npm run headless:lighting`
- Expected:
  - all five presets render successfully
  - debug sidecars include `lighting.*` fields
  - sunrise air mass is substantially higher than noon
  - noon direct illuminance exceeds sunrise and night
  - sunset keeps the primary star near the horizon
  - second-sun preset keeps the primary below horizon and secondary above it
  - night daylight factor is near zero and exposure remains below noon

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

7. Equatorial solar altitude day arc: `PASS`
- Evidence (`/tmp/eq-h6.log`, `/tmp/eq-h9.log`, `/tmp/eq-h12.log`, `/tmp/eq-h15.log`, `/tmp/eq-h18.log`):
  - `06:00`: primary altitude ~`0.0` degrees
  - `09:00`: primary altitude ~`43.8` degrees
  - `12:00`: primary altitude ~`78.4` degrees
  - `15:00`: primary altitude ~`43.9` degrees
  - `18:00`: primary altitude ~`0.0` degrees

8. Accelerated midnight continuity: `PASS`
- Evidence (Playwright sample loop captured on 2026-03-09):
  - `binarySimulationDays` advances from `0.9933` to `1.0146` to `1.0426` while `time24` wraps from `23:50` to `00:21` to `01:01`
  - corresponding solar altitudes continue smoothly from `-78.36` to `-77.47` to `-71.00` degrees
  - no orbital-state reset was observed at midnight wrap

9. Preset matrix reproducibility: `PASS`
- Evidence (`output/matrix-*.png`, `output/matrix-*.json`):
  - all configured preset cases completed without renderer failure
  - scene labels, preset labels, and debug state align with routed preset state

10. Debug sidecar output: `PASS`
- Evidence (`output/*-debug.json`):
  - each headless render now writes a JSON dump containing `scene`, `activePresetKey`, `cameraPos`, `cameraTarget`, `binaryDayHours`, and solar-altitude fields where applicable

11. Lighting regression: `PASS`
- Evidence (`npm run headless:lighting`, `output/lighting-*.png`, `output/lighting-*-debug.json`):
  - sunrise: `primaryAirMass=36.467`, `secondaryAirMass=2.374`, `hazeFactor=0.4332`
  - noon: `primaryAirMass=1.181`, `primaryDirectIlluminance=0.7698`, `exposure=0.48`
  - sunset: `primaryAltitudeDeg≈0`, `twilightFactor=0.2631`, `hazeFactor=0.6208`
  - second sun: `primaryAltitudeDeg=-2.02`, `secondaryAltitudeDeg=13.88`
  - night: `daylightFactor=0`, `exposure=0.29`
  - regression script completed with `Lighting regression OK.`
