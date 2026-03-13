import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = path.resolve(process.cwd());
const root = path.join(projectRoot, "dist");
if (!fs.existsSync(root)) {
  throw new Error("Build output missing at ./dist. Run `npm run build` first.");
}

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function approx(a, b, tolerance, label) {
  assert(Math.abs(a - b) <= tolerance, `${label}: expected ${b}, got ${a}`);
}

const server = http.createServer((req, res) => {
  try {
    const parsed = new URL(req.url, "http://127.0.0.1");
    const urlPath = parsed.pathname === "/" ? "/index.html" : parsed.pathname;
    const fsPath = path.join(root, decodeURIComponent(urlPath));
    if (!fsPath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const stat = fs.statSync(fsPath);
    if (stat.isDirectory()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(fsPath).toLowerCase();
    res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
    fs.createReadStream(fsPath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

const port = await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve(server.address().port));
});

function outputPath(name) {
  return path.join(projectRoot, "output", name);
}

async function getUiState(page) {
  return page.evaluate(() => {
    const readRect = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return null;
      const rect = el.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const text = (selector) => document.querySelector(selector)?.textContent?.trim() || "";
    const display = (selector) => window.getComputedStyle(document.querySelector(selector)).display;
    return {
      scene: document.getElementById("sceneChooser")?.value || "",
      presetDisplay: display("#presetChooser"),
      timeDisplay: display("#timeIndicator"),
      timeRateDisplay: display("#timeRateButton"),
      modeText: text("#modeBadge"),
      timeText: text("#timeIndicator"),
      audioText: text("#audioToggle"),
      hudRect: readRect(".hud"),
      viewerRect: readRect("#viewerSchematic"),
      orbitRect: readRect("#orbitSchematic"),
      diagnosticsRect: readRect("#diagnosticsPanel"),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      debug: window.__demoState?.debug || null,
    };
  });
}

function assertRectWithinViewport(rect, viewport, label) {
  if (!rect) return;
  assert(rect.left >= -1, `${label} left overflow: ${rect.left}`);
  assert(rect.top >= -1, `${label} top overflow: ${rect.top}`);
  assert(rect.right <= viewport.width + 1, `${label} right overflow: ${rect.right} > ${viewport.width}`);
  assert(rect.bottom <= viewport.height + 1, `${label} bottom overflow: ${rect.bottom} > ${viewport.height}`);
}

let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--disable-web-security",
    ],
  });

  const desktopPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  desktopPage.on("pageerror", (err) => pageErrors.push(`pageerror: ${err.message}`));
  desktopPage.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(`console.error: ${msg.text()}`);
  });

  await desktopPage.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(1600);
  const startup = await getUiState(desktopPage);
  assert(startup.scene === "binaryTwilightSurface", "Twilight relay should be the default scene");
  assert(startup.debug?.activePresetKey === "relay-pre-sunset", `Startup preset mismatch: ${startup.debug?.activePresetKey}`);
  assert(startup.presetDisplay !== "none", "Twilight relay should show preset chooser");
  assert(startup.timeDisplay !== "none", "Twilight relay should show time indicator");
  assert(startup.timeRateDisplay !== "none", "Twilight relay should show time multiplier");

  await desktopPage.click("#audioToggle");
  await desktopPage.waitForTimeout(300);
  const audioStarted = await getUiState(desktopPage);
  assert(audioStarted.audioText === "Stop Audio", `Audio button should toggle to Stop Audio, got ${audioStarted.audioText}`);

  await desktopPage.selectOption("#sceneChooser", "binaryExternal");
  await desktopPage.waitForTimeout(1400);
  const external = await getUiState(desktopPage);
  assert(external.scene === "binaryExternal", "Scene chooser should switch to binaryExternal");
  assert(external.presetDisplay !== "none", "External scene should show preset chooser");
  assert(external.timeDisplay !== "none", "External scene should show time badge");
  assert(external.timeText === "System View", `External time badge should read System View, got ${external.timeText}`);
  assert(external.timeRateDisplay === "none", "External scene should hide time multiplier");

  await desktopPage.selectOption("#sceneChooser", "binarySurface");
  await desktopPage.waitForTimeout(1400);
  const surface = await getUiState(desktopPage);
  assert(surface.scene === "binarySurface", "Scene chooser should switch to binarySurface");
  assert(surface.presetDisplay !== "none", "Surface scene should show preset chooser");
  assert(surface.timeDisplay !== "none", "Surface scene should show time indicator");
  assert(surface.timeRateDisplay !== "none", "Surface scene should show time multiplier");

  await desktopPage.selectOption("#sceneChooser", "clocktower");
  await desktopPage.waitForTimeout(1000);
  await desktopPage.selectOption("#sceneChooser", "binaryTwilightSurface");
  await desktopPage.waitForTimeout(1400);
  const switchedRelay = await getUiState(desktopPage);
  assert(switchedRelay.scene === "binaryTwilightSurface", "Scene chooser should switch to binaryTwilightSurface");
  assert(switchedRelay.debug?.activePresetKey === "relay-pre-sunset", `Scene switch should restore relay preset, got ${switchedRelay.debug?.activePresetKey}`);
  approx(switchedRelay.debug?.binaryDayHours, 17.8736, 0.35, "scene-switch relay hour");

  await desktopPage.goto(`http://127.0.0.1:${port}/?scene=binarySurface&preset=surface-sunset&binaryLat=24&binaryLon=30&timeMultiplier=8&cinematic=1`, { waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(1200);
  const routeState = await getUiState(desktopPage);
  assert(routeState.debug?.scene === "binarySurface", "Deep link should restore binarySurface");
  assert(routeState.debug?.activePresetKey === "surface-sunset", `Deep link preset mismatch: ${routeState.debug?.activePresetKey}`);
  approx(routeState.debug?.observerLatitudeTravelDeg, 24, 0.2, "deep-link latitude travel");
  approx(routeState.debug?.observerLongitudeBaseDeg, 30, 0.2, "deep-link longitude base");
  assert(routeState.debug?.timeMultiplier === 8, `Deep link time multiplier mismatch: ${routeState.debug?.timeMultiplier}`);
  assert(routeState.debug?.cinematic === true, "Deep link cinematic should restore true");
  await desktopPage.reload({ waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(1200);
  const routeReloadState = await getUiState(desktopPage);
  approx(routeReloadState.debug?.observerLatitudeTravelDeg, 24, 0.2, "reloaded latitude travel");
  approx(routeReloadState.debug?.observerLongitudeBaseDeg, 30, 0.2, "reloaded longitude base");
  assert(routeReloadState.debug?.timeMultiplier === 8, "Reload should preserve time multiplier");
  assert(routeReloadState.debug?.cinematic === true, "Reload should preserve cinematic flag");

  await desktopPage.goto(`http://127.0.0.1:${port}/?scene=binaryExternal&preset=external-wide&binaryHour=6&binaryHourRate=0`, { waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(1200);
  const externalDawn = await getUiState(desktopPage);
  await desktopPage.goto(`http://127.0.0.1:${port}/?scene=binaryExternal&preset=external-wide&binaryHour=18&binaryHourRate=0`, { waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(1200);
  const externalDusk = await getUiState(desktopPage);
  approx(externalDawn.debug?.backgroundLuma, externalDusk.debug?.backgroundLuma, 0.0005, "external background luma invariance");
  approx(externalDawn.debug?.fogDensity, externalDusk.debug?.fogDensity, 0.0005, "external fog density invariance");

  await desktopPage.goto(`http://127.0.0.1:${port}/?scene=binaryTwilightSurface`, { waitUntil: "networkidle" });
  await desktopPage.waitForTimeout(1200);
  const relayRouteDefault = await getUiState(desktopPage);
  assert(relayRouteDefault.scene === "binaryTwilightSurface", "Bare relay route should restore twilight scene");
  assert(relayRouteDefault.debug?.activePresetKey === "relay-pre-sunset", `Bare relay route preset mismatch: ${relayRouteDefault.debug?.activePresetKey}`);
  approx(relayRouteDefault.debug?.binaryDayHours, 17.8736, 0.35, "bare relay route hour");

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const mobileCases = [
    { route: `http://127.0.0.1:${port}/`, slug: "mobile-relay-pre-sunset" },
    { route: `http://127.0.0.1:${port}/?scene=binaryExternal&preset=external-wide`, slug: "mobile-external-wide" },
    { route: `http://127.0.0.1:${port}/?scene=binarySurface&preset=surface-sunrise`, slug: "mobile-surface-sunrise" },
  ];

  const mobileResults = [];
  for (const mobileCase of mobileCases) {
    await mobilePage.goto(mobileCase.route, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(1400);
    const state = await getUiState(mobilePage);
    assertRectWithinViewport(state.hudRect, state.viewport, `${mobileCase.slug} hud`);
    assertRectWithinViewport(state.viewerRect, state.viewport, `${mobileCase.slug} viewer schematic`);
    assertRectWithinViewport(state.orbitRect, state.viewport, `${mobileCase.slug} orbit schematic`);
    if (state.viewerRect && state.hudRect) {
      assert(state.viewerRect.bottom < state.hudRect.top - 8, `${mobileCase.slug} viewer schematic overlaps HUD`);
    }
    if (state.orbitRect && state.hudRect) {
      assert(state.orbitRect.bottom < state.hudRect.top - 8, `${mobileCase.slug} orbit schematic overlaps HUD`);
    }
    if (state.viewerRect && state.orbitRect) {
      const horizontalGap = state.orbitRect.left - state.viewerRect.right;
      const verticalGap = state.viewerRect.top - state.orbitRect.bottom;
      assert(
        horizontalGap >= 8 || verticalGap >= 8,
        `${mobileCase.slug} schematics overlap each other`,
      );
    }
    await mobilePage.screenshot({ path: outputPath(`${mobileCase.slug}-page.png`), fullPage: true });
    mobileResults.push({ slug: mobileCase.slug, state });
  }

  assert(pageErrors.length === 0, `Unexpected page errors: ${pageErrors.join(" | ")}`);

  console.log("UI regression OK.");
  console.log(JSON.stringify({
    startup,
    external,
    surface,
    switchedRelay,
    routeReloadState,
    relayRouteDefault,
    externalDawn: externalDawn.debug,
    externalDusk: externalDusk.debug,
    mobileResults,
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
