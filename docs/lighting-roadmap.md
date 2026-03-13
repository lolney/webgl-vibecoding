# Physically Based Lighting Roadmap

## Goal

Upgrade the demoscene from stylized lighting toward a more principled physically based model, with emphasis on:

- atmospheric scattering
- geometric horizon clipping for luminous star discs
- sunrise/sunset color accuracy
- volumetric lighting
- post-optical glare and diffraction for compact bright emitters
- physically meaningful emissive stars and moonlight
- water/air interaction that stays readable in both artistic and debug views

## Principles

- One simulation state should drive all lighting inputs.
- Local sky color, sun disc intensity, fog, and reflections should derive from star altitude and optical path length, not scene-specific hacks.
- Stars should disappear only because of geometry, extinction, occlusion, or optics. No presentation-driven fades.
- Effects should remain tunable for art direction, but the base model should be physically coherent.
- Every lighting stage needs headless validation cases with screenshots and debug dumps.

## Current Assessment

The current implementation is physically motivated, not physically accurate.

What is already in place:

- a shared lighting state derived from orbital simulation
- air-mass-based extinction and apparent star color shifts
- a lightweight Rayleigh/Mie-inspired surface sky shader
- separation between visible star discs and direct scene lighting
- automated headless lighting regression coverage

What remains materially non-physical:

- sky color is still driven mostly by artist-chosen day/night/twilight palette lerps rather than atmosphere-derived radiance
- "photometric" quantities are normalized heuristics, not consistent light units
- scattering is a local shader approximation, not optical-depth integration through an atmosphere
- star discs and halos are billboards with hand-tuned scales and intensities
- ocean response is still effect-driven rather than a proper Fresnel + rough-surface BRDF
- non-celestial fill/ambient paths still exist in the renderer and complicate physical reasoning

This roadmap therefore distinguishes between:

- physically plausible: coherent enough to reason about, with principled approximations
- physically rigorous: closer to radiometric and atmospheric correctness

The target for this project should be physically plausible by default, with selected rigorous pieces where the visual payoff is high.

## Horizon Rendering Phases

These phases specifically cover how luminous star discs behave near the horizon in the relay and surface scenes.

### H1. Geometric disc / horizon intersection

- Model disc visibility from apparent angular radius and horizon intersection.
- Render partial discs when only part of the source is above the horizon.
- Remove any altitude-only fade logic.
- Status:
  - implemented for relay and surface star discs

### H2. Source radiance through atmosphere

- Derive direct source brightness from:
  - apparent angular area
  - atmospheric transmittance
  - visible disc fraction
- Distinguish:
  - direct disc radiance
  - in-scattered halo radiance
  - surface illumination
- Status:
  - implemented in first-order form
- Remaining gap:
  - optical depth is still an approximation and not yet integrated along the full view ray for every source sample

### H3. Atmospheric sky integration around the horizon

- Replace simple horizon shaping with a sky model driven by:
  - view optical depth
  - sun-ray optical depth
  - Rayleigh and aerosol scattering
- Required behavior:
  - twilight emerges from atmosphere transport
  - low-angle sources stay embedded in a coherent scattering field
  - relay transitions read as a sky event, not a sprite transition

### H4. Surface BRDF and horizon reflections

- Let low-angle reflections emerge from:
  - Fresnel response
  - rough-surface glitter
  - reflected sky radiance
- Remove remaining painted-looking reflection strips near the horizon.

### H5. Post-optical glare and diffraction

- Treat bloom, glare, and diffraction as camera/optics effects after radiance formation.
- Feed them from bright source masks and atmospheric energy, not source alpha hacks.
- Keep them subordinate to the physical visibility model.

## Phase 1: Photometric Cleanup

### 1. Normalize light units and emissive sources

- Define relative luminous intensity for:
  - primary star
  - secondary star
  - moon
  - clocktower strobes / spotlights
- Separate:
  - visible disc brightness
  - volumetric scattering contribution
  - direct scene illumination
- Stop using the same scalar for both “looks bright on screen” and “lights the world”.
- Status:
  - partially implemented
  - the code now separates several of these paths, but the values are still normalized artistic weights rather than consistent radiometric units
- Next correction:
  - define one internal lighting scale for stellar irradiance at the observer and derive downstream terms from that instead of independent constants
  - ensure bloom/exposure are downstream display controls, not upstream light energy knobs

### 2. Build a shared lighting state object

- Add a shared `computeLightingState()` derived from orbital simulation:
  - star elevations / azimuths
  - optical air mass approximation
  - twilight classification
  - direct irradiance proxy
  - ambient sky contribution
  - water reflection weighting
- Make all scenes consume this instead of ad hoc per-scene formulas.
- Status:
  - implemented for the binary scenes
- Remaining gap:
  - extend shared ownership to the rest of the renderer so scene-local and global fill lights do not bypass the lighting model
  - split the lighting state into:
    - simulation-space source radiometry
    - atmospheric transport
    - camera/display response

## Phase 2: Atmospheric Scattering

### 3. Replace current surface sky gradient with a scattering approximation

- Start with a lightweight single-scattering model:
  - Rayleigh term for blue sky
  - Mie term for haze and forward scattering near the sun
- Inputs:
  - view direction
  - sun direction(s)
  - observer altitude
  - density falloff
- Required behavior:
  - blue zenith at day
  - warm low-angle sunlight at sunrise/sunset
  - smooth twilight rolloff
  - second star contribution layered physically, not just color-added
- Status:
  - implemented as a lightweight approximation
- Current limitation:
  - the shader still blends between fixed sky palettes; the atmosphere does not yet emerge from integrated optical depth
- Next correction:
  - move from palette-driven sky color to atmosphere-derived radiance
  - compute scattering from extinction coefficients, density falloff, and per-star transmittance along the view ray

### 4. Add atmospheric extinction for sun discs

- Sun/star color and intensity at the horizon should be attenuated by optical depth.
- Required behavior:
  - stars dim and warm near horizon
  - secondary star can appear cooler and weaker
  - noon discs tighten and stop blooming excessively
- Status:
  - implemented in a first-order form
- Current limitation:
  - extinction is RGB-exp(-k * airMass) with hand-chosen coefficients, and disc size/halo shape are still artist-tuned billboards
- Next correction:
  - move to coarse wavelength-bucket extinction
  - derive disc angular size, halo spread, and bloom contribution from source size plus atmospheric scattering rather than independent heuristics

## Phase 3: Volumetrics

### 5. Add volumetric aerial perspective

- Introduce distance-based in-scattering and transmittance:
  - ocean horizon fades into atmosphere
  - distant clocktower skyline picks up haze
  - external scene gains depth without muddying orbit readability
- Why this matters now:
  - the current sky can read plausibly, but the scene volume itself is still thin; horizon depth and distance cues are not yet governed by the same atmosphere model

### 6. Add volumetric light shafts for strong emitters

- Candidate emitters:
  - clocktower spotlights
  - strobes
  - low-angle stars near horizon
  - moon
- Implementation options:
  - screen-space radial scattering for first pass
  - later, low-resolution froxel/raymarch volume if needed
- Constraint:
  - shafts must be physically directional and intensity-limited, not generic bloom streaks

## Phase 4: Water and Surface BRDF

### 7. Improve ocean shading

- Replace current reflection heuristics with a more principled approximation:
  - Fresnel response
  - roughness-dependent highlight spread
  - sky-color reflection integration
  - sun glitter trail based on view/light geometry
- Required behavior:
  - sunrise/sunset reflection trails elongate naturally
  - midday specular does not become a white slab
  - moonlight reflection remains diffuse and readable
- Priority note:
  - this is likely the largest visual payoff remaining in the planet POV
- Current limitation:
  - the current `Water`-based approach and reflection planes remain heuristic and are the biggest source of non-physical appearance

### 8. Add shoreline / near-surface scattering cues

- Small-scale foam/haze where light skims the horizon
- Low-angle glints that respond to roughness and wind state

## Phase 5: Clocktower PBR Lighting

### 9. Make spotlights and strobes more physically grounded

- Separate beam cone, emitted intensity, and bloom contribution.
- Use inverse-square falloff where feasible.
- Add a volumetric cone pass for visible beams in haze.
- Make strobe timing drive exposure perception, not just emissive intensity.

### 10. Rework the moon as a proper celestial light source

- Visible moon disc
- diffuse sky contribution
- ocean reflection derived from geometry
- low-level fill light on the clocktower scene

## Cross-Cutting Cleanup

### 11. Remove or isolate non-celestial lighting shortcuts

- Audit ambient, hemisphere, fill, rim, and other helper lights scene by scene.
- In the planetary surface view:
  - stars should be the only primary light sources
  - any remaining fill should be explicitly modeled as atmospheric or ocean bounce, not hidden helper light
- In the clocktower view:
  - separate physically motivated moon/sky lighting from stylized performance lighting

### 12. Separate transport from display response

- Treat these as different layers:
  - source radiance / irradiance
  - atmospheric transport
  - surface BRDF response
  - camera/display response
- ACES, bloom, and exposure should shape presentation after the physical lighting state is computed, not substitute for it.

## Phase 6: Validation

### 13. Extend headless validation matrix

- Add lighting-specific captures:
  - surface sunrise
  - surface high day
  - surface sunset
  - second-sun event
  - moonlit night
  - clocktower spotlight beam test
- Save debug fields:
  - air mass
  - scattering coefficients
  - direct light intensity
  - ambient sky intensity
  - water reflection gain
- Extend the debug dump further to include:
  - per-star transmittance
  - apparent star chromaticity / color temperature proxy
  - sun angular size / halo parameters
  - surface Fresnel and reflection weighting
  - active non-celestial light contributions by scene

### 14. Add acceptance criteria

- Sunrise and sunset clearly read without manual explanation.
- Noon remains bright but not blown out.
- Volumetric beams are visible only when justified by angle and haze.
- External view remains readable: stars, planets, and orbits stay distinguishable.
- Headless captures remain stable across presets.
- Additional physical-plausibility criteria:
  - sky hue shifts emerge from extinction/scattering changes rather than palette jumps
  - the planet surface scene is explainable in terms of star geometry alone
  - water highlights narrow and broaden with view/light geometry, not just preset-dependent scalar tweaks
  - disabling helper lights does not collapse the binary surface scene

## Recommended Implementation Order

Completed:

1. Shared lighting state
2. Surface atmospheric scattering approximation
3. First-order sun-disc extinction and tonemapping cleanup

Next:

4. Remove or isolate non-celestial lighting shortcuts
5. Water BRDF/reflection cleanup
6. Volumetric aerial perspective
7. Spotlight/strobe volumetrics
8. Moon as physical light source
9. Expand headless validation matrix and physical debug fields

## Risks

- Full volumetrics can be too expensive for real-time if done naively.
- Physically correct values can look “less demoscene” unless art-direction controls remain available.
- Multi-star scattering can easily become unreadable without careful weighting and exposure control.
- A fully rigorous spectral atmosphere model may not justify its complexity here; the better tradeoff is a disciplined physically plausible model with explicit approximations.

## Success Criteria

- The surface scene reads as a coherent planetary atmosphere rather than a sky gradient plus sprites.
- The clocktower scene gains believable beams and moonlight without losing the neon demoscene identity.
- All major lighting states are reproducible through presets and headless captures.
- The remaining approximations are named, localized, and measurable rather than spread across scene-specific hacks.
