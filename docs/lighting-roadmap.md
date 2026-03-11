# Physically Based Lighting Roadmap

## Goal

Upgrade the demoscene from stylized lighting toward a more principled physically based model, with emphasis on:

- atmospheric scattering
- sunrise/sunset color accuracy
- volumetric lighting
- physically meaningful emissive stars and moonlight
- water/air interaction that stays readable in both artistic and debug views

## Principles

- One simulation state should drive all lighting inputs.
- Local sky color, sun disc intensity, fog, and reflections should derive from star altitude and optical path length, not scene-specific hacks.
- Effects should remain tunable for art direction, but the base model should be physically coherent.
- Every lighting stage needs headless validation cases with screenshots and debug dumps.

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

### 2. Build a shared lighting state object

- Add a shared `computeLightingState()` derived from orbital simulation:
  - star elevations / azimuths
  - optical air mass approximation
  - twilight classification
  - direct irradiance proxy
  - ambient sky contribution
  - water reflection weighting
- Make all scenes consume this instead of ad hoc per-scene formulas.

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

### 4. Add atmospheric extinction for sun discs

- Sun/star color and intensity at the horizon should be attenuated by optical depth.
- Required behavior:
  - stars dim and warm near horizon
  - secondary star can appear cooler and weaker
  - noon discs tighten and stop blooming excessively

## Phase 3: Volumetrics

### 5. Add volumetric aerial perspective

- Introduce distance-based in-scattering and transmittance:
  - ocean horizon fades into atmosphere
  - distant clocktower skyline picks up haze
  - external scene gains depth without muddying orbit readability

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

## Phase 6: Validation

### 11. Extend headless validation matrix

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

### 12. Add acceptance criteria

- Sunrise and sunset clearly read without manual explanation.
- Noon remains bright but not blown out.
- Volumetric beams are visible only when justified by angle and haze.
- External view remains readable: stars, planets, and orbits stay distinguishable.
- Headless captures remain stable across presets.

## Recommended Implementation Order

1. Shared lighting state
2. Surface atmospheric scattering
3. Sun-disc extinction and tonemapping cleanup
4. Water BRDF/reflection cleanup
5. Volumetric aerial perspective
6. Spotlight/strobe volumetrics
7. Moon as physical light source
8. Expand headless validation matrix

## Risks

- Full volumetrics can be too expensive for real-time if done naively.
- Physically correct values can look “less demoscene” unless art-direction controls remain available.
- Multi-star scattering can easily become unreadable without careful weighting and exposure control.

## Success Criteria

- The surface scene reads as a coherent planetary atmosphere rather than a sky gradient plus sprites.
- The clocktower scene gains believable beams and moonlight without losing the neon demoscene identity.
- All major lighting states are reproducible through presets and headless captures.
