# Next-Level Plan

Date: 2026-03-12

## Goal

Turn the remaining backlog into a staged execution plan that improves the renderer first, then uses those improved primitives to build stronger scenes and phenomena.

The main constraint is sequencing:
- renderer work should come before scene proliferation
- shared simulation/lighting primitives should come before one-off effects
- every new effect class should arrive with deterministic headless coverage

## Phase Order

### Phase A: Rendering Foundation

This phase increases physical plausibility and gives later scenes better primitives.

#### A1. Multi-order atmospheric scattering approximation

Why first:
- it affects sky color, aerial perspective, sunrise/sunset, shafts, and reflections
- later work on eclipses, aurora, and weather will depend on a stronger atmosphere model

Scope:
- move beyond the current first-order approximation
- add higher-order sky brightening and richer twilight structure
- improve horizon reddening and zenith-to-horizon transitions
- keep both stars contributing through the same transport model

Implementation notes:
- keep the current lightweight approach as a fallback path
- prefer a low-dimensional approximation or precomputed lookup approach over a heavy raymarch
- maintain a clean split between transport and display response

Validation:
- add headless captures for sunrise, noon, sunset, second-sun, and night
- extend debug dumps with scattering-order or integrated-atmosphere proxies
- check that hue shifts evolve smoothly across time instead of jumping at preset boundaries

Acceptance criteria:
- sunrise/sunset color shift reads as atmosphere-driven
- zenith, horizon, and twilight bands are visually distinct and stable
- both stars can contribute without flattening the sky into additive wash

#### A2. True volumetric participating media

Why second:
- better shafts and haze should build on the stronger atmosphere model
- this phase benefits both the binary surface and clocktower scenes

Scope:
- add a low-resolution volumetric medium for strong emitters
- unify star shafts, moon shafts, spotlights, and strobes under one model where practical
- keep the effect directional and intensity-limited

Implementation notes:
- start with a low-resolution froxel or screen-space volume hybrid
- ensure strong temporal stability in headless renders
- separate medium density from bloom so shafts are not just post-process streaks

Validation:
- add beam/shaft-specific captures for:
  - low-angle primary star
  - second-sun event
  - moonlit clocktower
  - spotlight / strobe sections
- add debug fields for per-emitter shaft intensity and medium density

Acceptance criteria:
- shafts are visible when justified by angle and haze
- midday does not produce fake volumetric clutter
- clocktower beams and celestial shafts feel like the same renderer family

#### A3. Better ocean BRDF and reflected-sky integration

Why third:
- the ocean remains one of the most visible weak points in the surface scene
- improved atmosphere should feed directly into sky reflection

Scope:
- improve Fresnel behavior
- integrate reflected sky radiance from the actual atmosphere model
- improve glitter, highlight spread, and low-angle reflection trails
- reduce slab-like daytime specular artifacts

Implementation notes:
- keep the water readable and stylized, but derive reflectance from view/light geometry
- separate wave shape, microfacet roughness, and reflected radiance more cleanly

Validation:
- sunrise/noon/sunset/night ocean captures
- debug metrics for Fresnel term, reflection gain, roughness response, and glitter width

Acceptance criteria:
- sunrise and sunset trails elongate naturally
- noon no longer creates the previous white-slab failure mode
- moon reflection and star reflection stay legible without overpowering the scene

#### A4. Stronger material separation and PBR response

Why fourth:
- once light transport and water improve, material identity becomes the next obvious gap

Scope:
- differentiate stars, planets, ocean, tower surfaces, emissives, and moonlight response
- strengthen roughness/metalness/specular discipline across scenes
- reduce the “everything is glowing plastic” failure mode

Validation:
- add material-focused stills for clocktower facade, planets, and ocean under multiple lighting conditions
- add debug toggles or dumps for active material parameters where useful

Acceptance criteria:
- stars read as luminous emitters
- planets read as materially distinct bodies
- clocktower surfaces react differently from water and emissive accents

## Phase B: Physical / Astronomical Phenomena

This phase expands the simulation vocabulary before building many new scenes.

#### B1. Seasonal axial-tilt behavior and solstice/equinox presets

Why first:
- it deepens the binary surface scene immediately
- it provides richer test cases for the atmosphere model

Scope:
- season parameterization
- solstice/equinox presets
- variation in daily solar arc by season and latitude

Validation:
- headless latitude/time sweeps for summer/winter/equinox
- debug fields for season phase and solar declination equivalent

Acceptance criteria:
- solar arc visibly changes by season
- high-latitude lighting behavior becomes more interesting and still coherent

#### B2. Planetary phases and reflected light

Why second:
- this improves both external and future moon/planet scenes
- it is a prerequisite for more convincing eclipses and gas giant scenes

Scope:
- phase-based shading in external view
- reflected-light contribution for night or twilight situations

Validation:
- external captures across orbital positions
- debug metrics for phase fraction and reflected-light intensity

Acceptance criteria:
- illuminated fraction reads immediately in external view
- reflected-light contribution is present but not confused with direct illumination

#### B3. Eclipses and transits

Why third:
- this is the highest-payoff phenomenon and will stress both geometry and lighting

Scope:
- star-star occultation
- planetary / lunar transits
- surface and external viewpoints where applicable

Validation:
- deterministic preset matrix for ingress, totality, egress
- debug metrics for overlap fraction and effective direct-light suppression

Acceptance criteria:
- eclipse stages are clearly distinguishable
- atmospheric response during totality is visually coherent
- external view remains readable while the event unfolds

#### B4. Tidal / orbital resonance cues

Scope:
- add resonance relationships and schematic cues
- use them to enrich system storytelling rather than as a pure physics exercise

Validation:
- schematic regressions and debug state checks

Acceptance criteria:
- resonance cues are understandable and not visually noisy

#### B5. Aurora / upper-atmosphere glow

Why late:
- it depends on a stable atmosphere/volumetric stack

Scope:
- high-latitude upper-atmosphere emission
- optional coupling to stellar activity or night-side conditions

Validation:
- night/high-latitude captures
- debug metrics for aurora intensity and latitude gating

Acceptance criteria:
- effect is strongest where expected
- it enhances the scene without obscuring solar or lunar cues

#### B6. Weather volumes

Why last in this phase:
- weather multiplies the complexity of atmosphere, light shafts, and water

Scope:
- fog banks, cloud layers, dust or mist variants
- should remain simulation-aware instead of arbitrary overlays

Validation:
- dedicated weather presets with visibility and shaft checks

Acceptance criteria:
- weather changes scene mood materially
- scene readability survives the added complexity

## Phase C: New Scenes

Build new showcase scenes after the renderer and shared phenomena are stronger.

#### C1. Eclipse scene

Why first:
- strongest immediate payoff
- reuses the binary system and new eclipse logic

Design goals:
- totality and near-totality variants
- strong sky and reflection transitions
- authored camera beats around ingress/egress

Required shared dependencies:
- improved atmosphere
- eclipse/transit logic
- stable volumetric medium

#### C2. Gas giant moonrise scene

Why second:
- showcases reflected light, phases, large-scale atmospherics, and horizon composition

Design goals:
- giant planet dominating the sky
- moonrise / ringlight / reflected cloud-band color
- strong parallax and horizon drama

Required shared dependencies:
- phase lighting
- improved sky/ocean or alternate surface BRDF
- stronger material separation

#### C3. Ice moon scene

Why third:
- best used as the material and volumetric stress test

Design goals:
- glancing low-angle light
- reflective ice, haze, and subtle subsurface cues
- austere high-contrast composition

Required shared dependencies:
- stronger PBR material stack
- improved volumetrics
- reflected-light handling

## Phase D: Presentation / Demoscene Escalation

This phase turns the project from a scene sandbox into a more authored demo.

#### D1. Authored scene progression

Scope:
- sequence multiple scenes into one intentional arc
- define timing, transitions, and handoff logic

Validation:
- headless scripted run that steps through the sequence and captures hero frames

Acceptance criteria:
- scene order feels composed, not arbitrary
- transitions preserve clarity of what the viewer is seeing

#### D2. Timeline-driven camera direction

Scope:
- replace generic camera drift with authored camera beats
- scene-specific camera choreography

Validation:
- scripted route/preset/timeline sweeps
- debug capture of camera mode and segment timing

Acceptance criteria:
- cameras reveal the important phenomenon at the right time
- manual control still works without corrupting timeline state

#### D3. Restrained audio-reactive modulation

Scope:
- modulate haze, bloom thresholds, subtle reflection shimmer, or light accents
- avoid direct corruption of orbital or physical state

Validation:
- deterministic audio override cases for regression

Acceptance criteria:
- modulation is perceptible but does not make the simulation feel arbitrary

#### D4. Capture / showcase tooling

Scope:
- scripted still and clip generation for hero presets and timelines
- repeatable capture profiles for desktop/mobile/promotional outputs

Validation:
- one-command render bundle generation
- manifest of capture outputs

Acceptance criteria:
- producing a showcase reel or still pack becomes routine rather than manual

## Recommended Commit Sequence

Use the existing loop:

1. commit a small coherent phase slice
2. implement
3. validate with focused headless coverage
4. manually inspect screenshots
5. add follow-up TODO items if a structural gap becomes obvious

Recommended sequence:
1. multi-order atmospheric scattering
2. volumetric participating media
3. ocean BRDF / reflected-sky integration
4. material separation / PBR cleanup
5. seasonal presets
6. phases and reflected light
7. eclipses and transits
8. first new scene: eclipse
9. authored presentation layer

## Global Validation Rules

For every remaining TODO item:
- add at least one deterministic headless case
- save debug JSON for the new physics/rendering state
- review both desktop and mobile compositions if UI is involved
- confirm no regressions to:
  - scene selection
  - URL sync
  - preset routing
  - diagnostics overlays
  - camera/manual mode behavior

## Definition of Done

The remaining backlog is complete when:
- rendering upgrades materially improve physical plausibility without destabilizing the demo
- at least two new high-quality showcase scenes are added
- at least three new astronomical/physical phenomena are demonstrated clearly
- the project can be run either as a scene sandbox or as an authored presentation
- headless capture coverage is sufficient to keep future iteration safe
