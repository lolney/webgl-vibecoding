import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = path.resolve(process.cwd());
const root = path.join(projectRoot, "dist");
if (!fs.existsSync(root)) {
  throw new Error("Build output missing at ./dist. Run `npm run build` first.");
}
const args = process.argv.slice(2);
const getArg = (name) => {
  const exact = args.find((a) => a.startsWith(`--${name}=`));
  return exact ? exact.slice(name.length + 3) : null;
};
const readNumberArg = (name) => {
  const raw = getArg(name);
  if (raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};
const debugMode = args.includes("--debug");
const scene = getArg("scene");
const preset = getArg("preset");
const hour = readNumberArg("hour");
const hourRate = readNumberArg("hour-rate");
const latitude = readNumberArg("lat");
const longitude = readNumberArg("lon");
const timeMultiplier = readNumberArg("time-multiplier");
const section = readNumberArg("section");
const beat = readNumberArg("beat");
const level = readNumberArg("level");
const azimuth = readNumberArg("azimuth");
const polar = readNumberArg("polar");
const distance = readNumberArg("distance");
const targetX = readNumberArg("target-x");
const targetY = readNumberArg("target-y");
const targetZ = readNumberArg("target-z");
const viewerDragX = readNumberArg("viewer-drag-x");
const viewerDragY = readNumberArg("viewer-drag-y");
const sweepAzimuthRaw = getArg("sweep-azimuth");
const waitMs = Math.max(100, readNumberArg("wait-ms") ?? 1800);
const outputName = getArg("name");
const sweepAzimuth = sweepAzimuthRaw
  ? sweepAzimuthRaw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v))
  : [];
const slug = outputName
  || [
    "headless",
    scene || "default",
    hour !== null ? `h${String(hour).replace(".", "_")}` : null,
    debugMode ? "debug" : null,
  ].filter(Boolean).join("-");

function toRad(v) {
  return Math.abs(v) > Math.PI * 2 ? (v * Math.PI) / 180 : v;
}

async function applyViewAndShot(page, view, localSlug) {
  if (
    view.azimuth !== null
    || view.polar !== null
    || view.distance !== null
    || view.targetX !== null
    || view.targetY !== null
    || view.targetZ !== null
  ) {
    await page.evaluate((next) => {
      if (typeof window.__setOrbitView === "function") {
        window.__setOrbitView(next);
      }
    }, view);
    await page.waitForTimeout(350);
  }
  const pagePath = path.join(projectRoot, "output", `${localSlug}-page.png`);
  const canvasPath = path.join(projectRoot, "output", `${localSlug}-canvas.png`);
  const debugPath = path.join(projectRoot, "output", `${localSlug}-debug.json`);
  await page.screenshot({ path: pagePath, fullPage: true, timeout: 60000 });
  const canvasPngDataUrl = await page.evaluate(() => {
    const canvas = window.__canvas || document.querySelector("canvas");
    return canvas ? canvas.toDataURL("image/png") : null;
  });
  if (!canvasPngDataUrl) {
    throw new Error("Canvas export failed: no canvas");
  }
  const base64 = canvasPngDataUrl.split(",")[1];
  fs.writeFileSync(canvasPath, Buffer.from(base64, "base64"));
  const shotStat = fs.statSync(canvasPath);
  if (shotStat.size < 5000) {
    throw new Error(`Screenshot too small (${shotStat.size} bytes), render likely failed`);
  }
  const canvasStats = await page.evaluate(() => {
    const source = window.__canvas || document.querySelector("canvas");
    if (!source) return null;
    const probe = document.createElement("canvas");
    probe.width = source.width;
    probe.height = source.height;
    const ctx = probe.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, probe.width, probe.height);
    let lumaSum = 0;
    let peak = 0;
    let brightPixels = 0;
    let leftBrightPixels = 0;
    let rightBrightPixels = 0;
    let leftLumaSum = 0;
    let rightLumaSum = 0;
    const total = width * height;
    const edgeBand = Math.max(1, Math.floor(width * 0.12));
    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      const luma = r * 0.2126 + g * 0.7152 + b * 0.0722;
      lumaSum += luma;
      if (luma > peak) peak = luma;
      if (luma > 0.98) brightPixels += 1;
      if (x < edgeBand) {
        leftLumaSum += luma;
        if (luma > 0.98) leftBrightPixels += 1;
      } else if (x >= width - edgeBand) {
        rightLumaSum += luma;
        if (luma > 0.98) rightBrightPixels += 1;
      }
    }
    return {
      width,
      height,
      meanLuma: Number((lumaSum / Math.max(1, total)).toFixed(4)),
      peakLuma: Number(peak.toFixed(4)),
      brightPixelRatio: Number((brightPixels / Math.max(1, total)).toFixed(6)),
      leftEdgeMeanLuma: Number((leftLumaSum / Math.max(1, edgeBand * height)).toFixed(4)),
      rightEdgeMeanLuma: Number((rightLumaSum / Math.max(1, edgeBand * height)).toFixed(4)),
      leftEdgeBrightRatio: Number((leftBrightPixels / Math.max(1, edgeBand * height)).toFixed(6)),
      rightEdgeBrightRatio: Number((rightBrightPixels / Math.max(1, edgeBand * height)).toFixed(6)),
    };
  });
  const debugState = await page.evaluate(() => window.__demoState || null);
  if (debugState) {
    debugState.canvasStats = canvasStats;
  }
  fs.writeFileSync(debugPath, JSON.stringify(debugState, null, 2));
  return { pagePath, canvasPath, debugPath };
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
  page.setDefaultTimeout(60000);
  page.setDefaultNavigationTimeout(60000);

  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") pageErrors.push(`console.error: ${msg.text()}`);
  });

  const search = new URLSearchParams();
  if (debugMode) search.set("debug", "1");
  if (scene) search.set("scene", scene);
  if (preset) search.set("preset", preset);
  if (hour !== null) search.set("binaryHour", String(hour));
  if (hourRate !== null) search.set("binaryHourRate", String(hourRate));
  if (latitude !== null) search.set("binaryLat", String(latitude));
  if (longitude !== null) search.set("binaryLon", String(longitude));
  const route = `/${search.size ? `?${search.toString()}` : ""}`;
  await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: "networkidle" });
  if (timeMultiplier !== null) {
    await page.evaluate((nextMultiplier) => {
      if (typeof window.__setTimeMultiplier === "function") {
        window.__setTimeMultiplier(nextMultiplier);
      }
    }, timeMultiplier);
  }
  if (section !== null) {
    await page.evaluate((nextSection) => {
      if (typeof window.__setClocktowerSection === "function") {
        window.__setClocktowerSection(nextSection);
      }
    }, section);
  }
  if (beat !== null || level !== null) {
    await page.evaluate((nextDrive) => {
      if (typeof window.__setAudioDrive === "function") {
        window.__setAudioDrive(nextDrive);
      }
    }, { beat, level });
  }
  if (viewerDragX !== null || viewerDragY !== null) {
    const viewerCanvas = page.locator("#viewerSchematicCanvas");
    await viewerCanvas.waitFor({ state: "visible", timeout: 4000 });
    const bounds = await viewerCanvas.boundingBox();
    if (!bounds) {
      throw new Error("Viewer schematic canvas is not available for drag input");
    }
    const startX = bounds.x + bounds.width * 0.52;
    const startY = bounds.y + bounds.height * 0.52;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(
      startX + (viewerDragX ?? 0),
      startY + (viewerDragY ?? 0),
      { steps: 18 },
    );
    await page.mouse.up();
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(waitMs);
  const outputs = [];
  if (sweepAzimuth.length > 0) {
    for (const sweepVal of sweepAzimuth) {
      const rad = toRad(sweepVal);
      const localSlug = `${slug}-az${Math.round((rad * 180) / Math.PI)}`;
      const result = await applyViewAndShot(page, {
        azimuth: rad,
        polar,
        distance,
        targetX,
        targetY,
        targetZ,
      }, localSlug);
      outputs.push(result);
    }
  } else {
    const result = await applyViewAndShot(page, {
      azimuth,
      polar,
      distance,
      targetX,
      targetY,
      targetZ,
    }, slug);
    outputs.push(result);
  }

  const diagnostics = await page.evaluate(() => {
    const state = window.__demoState || null;
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    return { state, bodyBg };
  });

  if (pageErrors.length) {
    throw new Error(pageErrors.join("\n"));
  }

  if (!diagnostics.state?.ok) {
    throw new Error(`Renderer state invalid: ${JSON.stringify(diagnostics)}`);
  }

  if ((diagnostics.state.frames || 0) < 4 || (diagnostics.state.lastTime || 0) < 1.3) {
    throw new Error(`Renderer did not animate enough frames: ${JSON.stringify(diagnostics)}`);
  }

  console.log(
    `Headless render OK. frames=${diagnostics.state.frames} t=${Number(
      diagnostics.state.lastTime,
    ).toFixed(2)}s bg=${diagnostics.bodyBg}`,
  );
  console.log(`Route: ${route}`);
  console.log(`Debug: ${JSON.stringify(diagnostics.state.debug || {})}`);
  for (const out of outputs) {
    console.log(`Canvas screenshot: ${out.canvasPath}`);
    console.log(`Page screenshot: ${out.pagePath}`);
    console.log(`Debug dump: ${out.debugPath}`);
  }
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
