# Neon Clocktower Demoscene

Interactive WebGL demoscene built with Three.js, audio-reactive effects, and GitHub Pages deployment.

Live demo: https://lukeolney.me/webgl-vibecoding/

## Requirements

- Node.js 22+
- npm 10+

If you use `nvm`:

```bash
nvm use
```

## Install

```bash
npm install
```

## Run locally (interactive)

```bash
npm start
```

Then open the local Vite URL shown in your terminal (usually `http://localhost:5173`).

### Restart behavior during `npm start`

- No restart needed for normal app edits: files in `src/`, `index.html`, and CSS are hot-reloaded in the browser.
- Browser refresh may be needed if an edit is not HMR-safe, but the dev server usually stays running.
- Restart `npm start` after changes to tooling/runtime setup such as `package.json`, `vite.config.js`, Node version/dependency installs, or `.env*` files.

## Build production bundle

```bash
npm run build
```

## Preview production build locally

```bash
npm run preview
```

## Headless render check

Builds the app and runs a Playwright headless render/debug pass:

```bash
npm run headless
```

A canvas and full-page screenshot are written to `output/`.
Each run also writes a debug sidecar JSON with the current simulation/camera state.

## Headless preset matrix

Runs a fixed regression sweep across the major scenes and presets:

```bash
npm run headless:matrix
```

## Headless lighting regression

Runs the lighting-specific regression sweep for the binary surface scene. This validates the new shared lighting state, scattering pass, and sun-disc extinction/tonemapping behavior across canonical presets.

```bash
npm run headless:lighting
```

Cases covered:

- `surface-sunrise`
- `surface-noon`
- `surface-sunset`
- `surface-second-sun`
- `surface-night`

## Headless clocktower lighting regression

Runs deterministic clocktower lighting captures with explicit section/audio overrides so spotlight and strobe behavior can be validated in headless mode.

```bash
npm run headless:clocktower-lighting
```

## Headless latitude regression

Runs the planet-POV latitude wheel regression, including real drag interaction on the upper-left globe inset, pole wrapping, and viewer-heading stability checks.

```bash
npm run headless:latitude
```

## Headless UI / mobile regression

Runs scene-switching, deep-link URL restoration, audio start, and portrait-mobile layout checks.

```bash
npm run headless:ui
```

## Full test-phase regression

Runs the complete validation sweep used for test-phase sign-off.

```bash
npm run headless:test-phase
```

Examples:

```bash
# Binary surface POV at sunset
node scripts/headless-render.mjs --scene=binarySurface --hour=18.55 --hour-rate=0 --name=surf-sunset

# External system view at fixed angle
node scripts/headless-render.mjs \
  --scene=binaryExternal \
  --hour=14 \
  --hour-rate=0 \
  --azimuth=1.57 \
  --polar=1.05 \
  --distance=34 \
  --target-x=0 --target-y=0 --target-z=0 \
  --name=ext-angle

# Named preset routed through shared scene state
node scripts/headless-render.mjs \
  --scene=binarySurface \
  --preset=surface-second-sun \
  --name=surface-second-sun
```

Useful flags:

- `--scene=clocktower|binaryExternal|binarySurface`
- `--preset=<preset-key>`
- `--hour=<0-24>` and `--hour-rate=<float>`
- `--section=<0-3>`, `--beat=<0-1>`, `--level=<0-1>`
- `--azimuth`, `--polar`, `--distance`
- `--target-x`, `--target-y`, `--target-z`
- `--viewer-drag-x`, `--viewer-drag-y`
- `--wait-ms=<milliseconds>`
- `--debug` (disables post-processing)
- `--sweep-azimuth=0,90,180,270` (takes multiple angle shots in one run; values can be degrees or radians)

## Runtime controls

- `C`: toggle cinematic camera
- `D`: toggle diagnostics overlay
- Preset chooser: jump to reproducible scene states with URL sync
