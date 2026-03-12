import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { normalizeObserverCoordinates } from "../src/scenes/shared/binaryState.js";

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

async function drag(page, selector, dx, dy) {
  const locator = page.locator(selector);
  await locator.waitFor({ state: "visible", timeout: 4000 });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Could not drag ${selector}`);
  const startX = box.x + box.width * 0.52;
  const startY = box.y + box.height * 0.52;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 18 });
  await page.mouse.up();
}

async function getSnapshot(page) {
  return page.evaluate(() => ({
    state: window.__demoState?.debug || null,
    label: document.getElementById("viewerLatitude")?.textContent || "",
  }));
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const search = new URLSearchParams({
    scene: "binarySurface",
    preset: "surface-sunrise",
    binaryHourRate: "0.12",
  });
  await page.goto(`http://127.0.0.1:${port}/?${search.toString()}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);

  const baseline = await getSnapshot(page);
  assert(baseline.state?.scene === "binarySurface", "Surface scene should be active");
  approx(baseline.state.observerLatitudeDeg, 0, 0.1, "baseline latitude");
  approx(baseline.state.observerLongitudeDeg, 0, 0.1, "baseline longitude");

  await drag(page, "#viewerSchematicCanvas", 0, -120);
  await page.waitForTimeout(900);
  const southDrag = await getSnapshot(page);
  assert(southDrag.state.observerLatitudeDeg < -50, "Dragging up should move the observer toward the south pole");
  approx(southDrag.state.observerLongitudeDeg, 0, 0.5, "south-drag longitude");
  approx(
    southDrag.state.schematic.viewerTurnYaw,
    baseline.state.schematic.viewerTurnYaw,
    0.03,
    "viewer heading should stay fixed relative to the local horizon",
  );
  assert(
    southDrag.state.binarySimulationDays > baseline.state.binarySimulationDays,
    "Simulation time should continue progressing while dragging latitude",
  );
  assert(/LATITUDE -6[0-9]\./.test(southDrag.label), `Unexpected south latitude label: ${southDrag.label}`);
  await page.screenshot({ path: outputPath("latitude-regression-south-page.png"), fullPage: true });

  const directRoute = new URLSearchParams({
    scene: "binarySurface",
    preset: "surface-sunrise",
    binaryHourRate: "0",
    binaryLat: "60",
  });
  await page.goto(`http://127.0.0.1:${port}/?${directRoute.toString()}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  const directLat = await getSnapshot(page);
  approx(directLat.state.observerLatitudeDeg, 60, 0.1, "direct-route latitude");
  approx(directLat.state.observerLatitudeTravelDeg, 60, 0.1, "direct-route travel latitude");
  approx(directLat.state.observerLongitudeDeg, 0, 0.1, "direct-route longitude");
  assert(directLat.label.includes("60.0"), `Direct-route latitude label should show 60 deg: ${directLat.label}`);

  const poleRoute = new URLSearchParams({
    scene: "binarySurface",
    preset: "surface-sunrise",
    binaryHourRate: "0",
    binaryLat: "80",
  });
  await page.goto(`http://127.0.0.1:${port}/?${poleRoute.toString()}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await drag(page, "#viewerSchematicCanvas", 0, 80);
  await page.waitForTimeout(700);
  const poleWrap = await getSnapshot(page);
  const expectedPoleWrap = normalizeObserverCoordinates(124.8, 0);
  assert(
    poleWrap.state.observerLatitudeDeg >= 0 && poleWrap.state.observerLatitudeDeg < 90,
    `Pole-wrap latitude should stay normalized, got ${poleWrap.state.observerLatitudeDeg}`,
  );
  assert(
    poleWrap.state.observerLatitudeDeg < 80,
    `Pole-wrap latitude should continue past the pole onto the far side, got ${poleWrap.state.observerLatitudeDeg}`,
  );
  assert(
    poleWrap.state.observerLatitudeTravelDeg > 120,
    `Pole-wrap travel latitude should advance beyond 90 deg, got ${poleWrap.state.observerLatitudeTravelDeg}`,
  );
  approx(poleWrap.state.observerLongitudeDeg, expectedPoleWrap.longitudeDeg, 0.8, "pole-wrap longitude");
  assert(
    Number.isFinite(poleWrap.state.primaryAltitudeDeg) && Number.isFinite(poleWrap.state.secondaryAltitudeDeg),
    "Pole-wrap altitudes should remain finite",
  );
  assert(/LATITUDE [0-8][0-9]\.[0-9]°/.test(poleWrap.label), `Unexpected pole-wrap latitude label: ${poleWrap.label}`);
  await page.screenshot({ path: outputPath("latitude-regression-pole-wrap-page.png"), fullPage: true });

  await page.evaluate(() => {
    window.__setBinaryHourRate(0);
    window.__setObserverLatitude(0);
    window.__setObserverLongitude(0);
  });
  await page.waitForTimeout(400);
  const beforeTurn = await getSnapshot(page);
  await drag(page, "#gl", 28, 0);
  await page.waitForTimeout(400);
  const afterTurn = await getSnapshot(page);
  const turnDelta = Math.abs(afterTurn.state.schematic.viewerTurnYaw - beforeTurn.state.schematic.viewerTurnYaw);
  assert(turnDelta > 0.08, `Camera yaw drag should move viewer heading, got delta ${turnDelta}`);
  assert(turnDelta < 0.4, `Camera yaw drag should remain smooth, got delta ${turnDelta}`);

  console.log("Latitude regression OK.");
  console.log(JSON.stringify({
    baseline: baseline.state,
    southDrag: southDrag.state,
    poleWrap: poleWrap.state,
    afterTurn: afterTurn.state,
  }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
