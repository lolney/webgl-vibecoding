import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = path.resolve(process.cwd());
const outputPath = path.join(root, "output", "headless-shot.png");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};

const server = http.createServer((req, res) => {
  try {
    const urlPath = req.url === "/" ? "/index.html" : req.url;
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

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  const canvasPngDataUrl = await page.evaluate(() => {
    const canvas = window.__canvas || document.querySelector("canvas");
    return canvas ? canvas.toDataURL("image/png") : null;
  });
  if (!canvasPngDataUrl) {
    throw new Error("Canvas export failed: no canvas");
  }
  const base64 = canvasPngDataUrl.split(",")[1];
  fs.writeFileSync(outputPath, Buffer.from(base64, "base64"));

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

  const shotStat = fs.statSync(outputPath);
  if (shotStat.size < 5000) {
    throw new Error(`Screenshot too small (${shotStat.size} bytes), render likely failed`);
  }

  console.log(
    `Headless render OK. frames=${diagnostics.state.frames} t=${Number(
      diagnostics.state.lastTime,
    ).toFixed(2)}s bg=${diagnostics.bodyBg}`,
  );
  console.log(`Debug: ${JSON.stringify(diagnostics.state.debug || {})}`);
  console.log(`Screenshot: ${outputPath}`);
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
