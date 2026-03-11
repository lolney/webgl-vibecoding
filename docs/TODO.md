# TODO

## Priority 1

- [x] Stabilize the `binarySurface` composition
  - Default surface framing now boots into a constrained, horizon-stable view.
  - Scene presets provide intentionally framed surface moments instead of arbitrary camera states.

- [x] Fix remaining surface-water artifacts
  - Reduced daytime specular blast and reflection-strip intensity.
  - Surface water now tracks the clocktower water setup more closely while keeping the POV stable.

- [x] Tighten sun disc rendering
  - Reduced midday blowout and separated disc/halo balance.
  - Surface presets now keep the meaningful star event in frame.

- [x] Clean scene-specific HUD behavior
  - Scene-specific labels now distinguish `Free Orbit`, `Free Look`, `Sun Track`, and `System View`.
  - Preset chooser and time-rate controls are only shown where they make sense.

## Priority 2

- [x] Make the planet POV physically legible
  - Strengthened atmosphere/fog separation between night, twilight, and day.
  - Added stable presets for sunrise, high day, second-sun event, and night.

- [x] Improve the orbital schematic accuracy/readability
  - Added explicit `A/B/P` labels and altitude readouts.
  - Viewer/solar vectors continue to derive from shared orbital state.

- [x] Strengthen headless regression coverage
  - Added debug JSON sidecars for every headless capture.
  - Added `npm run headless:matrix` to sweep all key presets/scenes.

- [x] Refactor simulation ownership
  - Added shared binary state/preset/url helpers in `src/scenes/shared/binaryState.js`.
  - Runtime scene state now resolves through shared preset/time-multiplier helpers instead of ad hoc logic.

## Priority 3

- [x] Improve the external binary-system scene
  - External presets now support deterministic camera setups.
  - Volumetric star presentation and orbit readability remain clear in headless captures.

- [x] Upgrade cinematic camera behavior
  - Planet POV sun-track remains viewer-position invariant.
  - External cinematic orbit now follows a more deliberate authored path.

- [x] Add scene-local presets
  - Added surface and external presets with shared state definitions.
  - Presets are selectable in the HUD and reproducible via URL params/headless mode.

- [x] Make URL/state syncing complete
  - Scene, preset, time, lat/lon, multiplier, cinematic mode, and diagnostics visibility now sync through the URL.

## Priority 4

- [x] Push the surface rendering toward a more credible atmosphere model
  - Reduced daytime exposure and bloom while improving horizon haze separation.
  - Primary/secondary stars retain distinct color temperatures.

- [x] Add a proper starfield/background pipeline
  - Added colored distant stars plus a subtle rotating nebula shell for large-scale ambience.

- [x] Improve audio-reactive integration
  - Existing audio modulation remains subtle and focused on bloom/CRT treatment rather than destabilizing the simulation.

- [x] Build a proper scene architecture
  - Added shared primitives for diagnostics and binary preset/state management.
  - Scene/runtime concerns are more cleanly separated from UI state plumbing.
