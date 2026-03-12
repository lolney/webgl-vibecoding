# Test Phase Plan

Date: 2026-03-11

## Goal

Run a disciplined bug-finding and polish phase across the full demo before the next large feature wave.

Primary outcomes:
- catch scene-specific bugs and regressions
- tighten UI and presentation consistency across scenes
- expand headless/manual validation so rendering issues are reproducible
- create a ranked backlog for the next major creative/technical phase

## Scope

Scenes in scope:
- `clocktower`
- `binaryExternal`
- `binarySurface`

Systems in scope:
- scene routing and preset routing
- URL/state sync
- camera behavior and interaction modes
- HUD / badges / scene chooser / preset chooser
- diagnostics overlays and schematics
- orbital simulation consistency
- lighting and post-processing
- audio startup and audio-reactive behavior
- headless rendering and regression scripts
- desktop/mobile layout behavior

## Test Strategy

### 1. Automated regression sweep

Use and expand the existing headless suite first.

Core commands:
- `npm run build`
- `npm run headless:matrix`
- `npm run headless:lighting`
- `npm run headless:clocktower-lighting`
- `npm run headless:latitude`

Additional matrix expansions to add during test phase:
- azimuth sweeps for `binaryExternal`
- horizon-facing and zenith-facing sweeps for `binarySurface`
- mobile-size screenshots for all scenes
- URL round-trip cases for presets / time / latitude / multiplier / cinematic
- scene-switching sequences in one session
- audio-start smoke case

### 2. Manual acceptance review

Perform a scene-by-scene visual and interaction review on desktop and mobile dimensions.

For each scene:
- confirm default composition is intentional
- confirm controls shown are relevant to that scene
- confirm labels are accurate and understandable
- confirm cinematic/manual transitions make sense
- confirm there are no dead controls or unexplained indicators
- confirm the scene still reads clearly with post-processing enabled

### 3. Triage and fix loop

For each issue found:
- reproduce in headless if possible
- add or extend a regression test when the issue is deterministic
- fix the issue
- rerun the smallest relevant suite first, then the full suite
- capture before/after screenshots for visual changes

## Review Checklist

### Clocktower

Focus:
- camera framing and readability of the tower silhouette
- moon visibility and moon reflection coherence
- spotlight cone readability vs bloom washout
- strobe readability without overexposing the scene
- water horizon stability and reflection quality
- title treatment and scene identity

Likely review targets:
- whether the moon remains legible in all lighting sections
- whether strobes/spotlights feel physically grounded but still dramatic
- whether the water reads as ocean rather than generic reflective plane
- whether audio-reactive changes are strong enough to notice but not noisy

### Binary External

Focus:
- immediate readability of stars vs planets
- volumetric/light-source identity of stars
- orbit readability from multiple camera angles
- camera path quality in cinematic mode
- scale perception and depth cues

Likely review targets:
- whether stars are unmistakably the primary emitters
- whether planets are visually smaller and materially distinct
- whether orbit lines help rather than clutter
- whether external view remains compelling when rotated arbitrarily

### Binary Surface

Focus:
- physical coherence of day/night transitions
- sky/ocean readability across presets and latitudes
- stability of horizon framing
- correctness of pole crossing and latitude wheel behavior
- correctness and readability of both schematics
- continuity of viewer heading and sun-track mode

Likely review targets:
- whether the surface camera always reads as planet-surface POV
- whether sunrise/noon/sunset/night are unmistakable
- whether stars remain visible but not oversized or washed out
- whether the upper-left globe accurately communicates latitude and orientation
- whether the orbital schematic communicates site, stars, and viewer heading correctly

### Shared UI / UX

Focus:
- scene chooser labels
- preset chooser relevance per scene
- mode badge behavior per scene
- time display / multiplier display correctness
- diagnostics overlay clarity
- mobile layout and overlap

Likely review targets:
- remove or simplify controls that are only marginally useful
- ensure scene/preset switching never leaves stale labels behind
- ensure badge naming is consistent and understandable
- ensure overlays do not obscure critical scene content

## Deliverables

### A. Test-phase bug/polish backlog

Prioritized buckets:
1. correctness bugs
2. rendering defects
3. UI/interaction inconsistencies
4. scene composition/presentation polish
5. low-risk refactors that improve testability

### B. Validation expansion

By end of test phase, the headless suite should cover:
- all scenes
- all presets
- latitude/pole behavior
- lighting invariants
- representative camera sweeps
- representative viewport sizes
- URL/state restoration

### C. Sign-off criteria

The test phase is complete when:
- all known correctness bugs have deterministic reproductions and fixes
- all critical UI inconsistencies are resolved
- every scene has at least one stable, high-quality default composition
- full headless suite passes cleanly
- manual review shows no obvious broken control, clipped view, or unreadable scene state

## Next-Level Backlog

### Priority 1: Rendering realism upgrades

1. Multi-order atmospheric scattering approximation
- push the sky model beyond first-order single-scattering
- better sunrise/sunset gradients, twilight bands, and horizon reddening

2. True volumetric participating media
- low-resolution froxel or raymarch pass for haze and beams
- unify star shafts, moon shafts, and clocktower beams under one medium model

3. Better ocean BRDF and reflection integration
- wave-slope-driven glitter
- cleaner Fresnel response
- reflected sky radiance from the actual atmosphere model

4. Material response cleanup
- make stars, planets, water, tower surfaces, and emissive elements materially distinct
- strengthen PBR cues without losing the demo aesthetic

### Priority 2: New scenes

1. Eclipse scene
- total / annular eclipse variants
- heavy atmospheric color shifts
- shadow banding / corona-inspired stylization

2. Ice moon scene
- glancing low-angle sunlight over reflective ice and fog
- strong aerial perspective and colored subsurface cues

3. Gas giant moonrise scene
- observer on a moon with a giant planet dominating the sky
- cloud bands, rings, reflected light, and eclipses

4. Deep-space flythrough scene
- travel through a debris field / ring plane / ionized nebula
- volumetric lighting and long exposure aesthetics

### Priority 3: Astronomical / physical phenomena

1. Eclipses and transits
- star-star occultation
- moon/planet transits in front of one or both stars

2. Seasonal axial-tilt behavior
- change solar arc shape by season and latitude
- solstice/equinox presets

3. Planetary phases and reflected light
- visible phases for moons/planets in external view
- reflected-light contribution to night scenes

4. Tidal / orbital resonance cues
- stylized but physically grounded resonance relationships
- useful for schematic storytelling

5. Aurora / upper-atmosphere glow
- especially strong at high latitudes
- can be tied to stellar activity events

6. Weather volumes
- layered cloud decks, mist banks, or dust haze
- should remain simulation-aware and not arbitrary FX

### Priority 4: Presentation / demoscene escalation

1. Authored scene progression
- sequence scenes into a coherent demo arc instead of disconnected scene selection

2. Timeline-driven camera direction
- choreographed transitions, beats, and reveals synced to music

3. Audio-reactive modulation with restraint
- modulation of haze, bloom threshold, reflection streaks, and lens artifacts
- avoid breaking physical coherence

4. Capture / showcase tooling
- scripted hero renders and stitched reels from headless presets
- make it easy to generate promo stills and clips
