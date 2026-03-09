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

A screenshot is written to:

- `output/headless-shot.png`
