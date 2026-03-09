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
```

Useful flags:

- `--scene=clocktower|binaryExternal|binarySurface`
- `--hour=<0-24>` and `--hour-rate=<float>`
- `--azimuth`, `--polar`, `--distance`
- `--target-x`, `--target-y`, `--target-z`
- `--wait-ms=<milliseconds>`
- `--debug` (disables post-processing)
