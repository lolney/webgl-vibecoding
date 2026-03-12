import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cases = [
  { preset: "eclipse-ingress", name: "eclipse-scene-ingress" },
  { preset: "eclipse-totality", name: "eclipse-scene-totality" },
  { preset: "eclipse-egress", name: "eclipse-scene-egress" },
];

for (const entry of cases) {
  const result = spawnSync(
    "node",
    [
      "scripts/headless-render.mjs",
      "--scene=eclipseScene",
      `--preset=${entry.preset}`,
      "--hour-rate=0",
      `--name=${entry.name}`,
      "--wait-ms=2200",
    ],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readDebug(name) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, "output", `${name}-debug.json`), "utf8")).debug;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const ingress = readDebug("eclipse-scene-ingress");
const totality = readDebug("eclipse-scene-totality");
const egress = readDebug("eclipse-scene-egress");

assert(ingress.scene === "eclipseScene", "Ingress render should use eclipseScene");
assert(totality.scene === "eclipseScene", "Totality render should use eclipseScene");
assert(egress.scene === "eclipseScene", "Egress render should use eclipseScene");
assert(ingress.activePresetKey === "eclipse-ingress", "Ingress preset should be active");
assert(totality.activePresetKey === "eclipse-totality", "Totality preset should be active");
assert(egress.activePresetKey === "eclipse-egress", "Egress preset should be active");
assert(ingress.secondaryStarEclipseFraction > 0.3, "Ingress should materially eclipse the secondary star");
assert(totality.secondaryOcclusionFraction > 0.9, "Totality should heavily occlude the secondary star");
assert(egress.secondaryStarEclipseFraction < totality.secondaryStarEclipseFraction, "Egress should reduce eclipse overlap");
assert(totality.cameraPos[2] > 6, "Eclipse scene should stage the camera in front of the eclipse plane");

console.log("Eclipse scene regression OK.");
console.log(JSON.stringify({
  ingress: {
    occlusion: ingress.secondaryOcclusionFraction,
    cameraPos: ingress.cameraPos,
  },
  totality: {
    occlusion: totality.secondaryOcclusionFraction,
    cameraPos: totality.cameraPos,
  },
  egress: {
    occlusion: egress.secondaryOcclusionFraction,
    cameraPos: egress.cameraPos,
  },
}, null, 2));
