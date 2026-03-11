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
const azimuth = readNumberArg("azimuth");
const polar = readNumberArg("polar");
const distance = readNumberArg("distance");
const targetX = readNumberArg("target-x");
const targetY = readNumberArg("target-y");
const targetZ = readNumberArg("target-z");
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
  await page.screenshot({ path: pagePath, fullPage: true });
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
  const debugState = await page.evaluate(() => window.__demoState || null);
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
