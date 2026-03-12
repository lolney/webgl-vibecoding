import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const port = await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    resolve(address.port);
  });
});

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
  const url = `http://127.0.0.1:${port}/?scene=binarySurface&preset=surface-sunset&binaryHourRate=0`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const before = await page.evaluate(async () => {
    window.__setCinematic?.(false);
    window.__setOrbitView?.({ azimuth: 0.38, polar: 1.28, distance: 12.4 });
    await new Promise((resolve) => window.setTimeout(resolve, 120));
    return structuredClone(window.__demoState?.debug);
  });

  await page.waitForTimeout(2200);

  const after = await page.evaluate(() => structuredClone(window.__demoState?.debug));

  const beforePitch = before.surfaceLookLocal[1];
  const afterPitch = after.surfaceLookLocal[1];
  const beforeTargetY = before.cameraTarget[1];
  const afterTargetY = after.cameraTarget[1];

  assert(before.cinematic === false, "Manual mode should be active before drift check");
  assert(after.cinematic === false, "Manual mode should stay active during drift check");
  assert(Math.abs(afterPitch - beforePitch) < 0.004, `Manual pitch drifted: before=${beforePitch} after=${afterPitch}`);
  assert(Math.abs(afterTargetY - beforeTargetY) < 0.08, `Camera target Y drifted: before=${beforeTargetY} after=${afterTargetY}`);

  await page.evaluate(async () => {
    window.__setCinematic?.(false);
    window.__setOrbitView?.({ azimuth: 0, polar: 1.28, distance: 12.4 });
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  });

  const canvas = page.locator("#gl");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("Main canvas unavailable for drag regression");

  const startX = bounds.x + bounds.width * 0.5;
  const startY = bounds.y + bounds.height * 0.5;
  const dragBefore = await page.evaluate(() => window.__getOrbitView?.());
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 140, startY, { steps: 18 });
  await page.mouse.up();
  await page.waitForTimeout(160);
  const dragAfter = await page.evaluate(() => window.__getOrbitView?.());

  assert(
    dragAfter.azimuth > dragBefore.azimuth + 0.18,
    `Dragging right should increase azimuth, before=${dragBefore.azimuth} after=${dragAfter.azimuth}`,
  );

  console.log("Camera regression OK.");
  console.log(JSON.stringify({
    beforePitch,
    afterPitch,
    beforeTargetY,
    afterTargetY,
    beforeCinematicMix: before.cinematicMix,
    afterCinematicMix: after.cinematicMix,
    dragBeforeAzimuth: dragBefore.azimuth,
    dragAfterAzimuth: dragAfter.azimuth,
  }, null, 2));
} finally {
  await browser?.close();
  server.close();
}
