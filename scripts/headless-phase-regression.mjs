import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cases = [
  { preset: "external-wide", name: "phase-wide" },
  { preset: "external-crescent", name: "phase-crescent" },
];

for (const entry of cases) {
  const result = spawnSync(
    "node",
    ["scripts/headless-render.mjs", "--scene=binaryExternal", `--preset=${entry.preset}`, "--hour-rate=0", `--name=${entry.name}`, "--wait-ms=1800"],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readDebug(name) {
  const filePath = path.join(projectRoot, "output", `${name}-debug.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")).debug;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const wide = readDebug("phase-wide");
const crescent = readDebug("phase-crescent");

assert(wide.combinedPhaseFraction > 0.8, "Wide preset should present a strongly illuminated phase");
assert(crescent.combinedPhaseFraction < 0.2, "Crescent preset should present a thin illuminated phase");
assert(wide.combinedPhaseFraction > crescent.combinedPhaseFraction + 0.5, "Wide and crescent presets should be materially separated");
assert(wide.reflectedLightFactor > 0.12, "Wide preset should retain a visible reflected-light contribution");
assert(crescent.reflectedLightFactor > 0.02, "Crescent preset should retain some reflected-light contribution");
assert(wide.primaryPhaseFraction > crescent.primaryPhaseFraction, "Primary phase fraction should fall from wide to crescent");
assert(wide.secondaryPhaseFraction > crescent.secondaryPhaseFraction, "Secondary phase fraction should fall from wide to crescent");

console.log("Phase regression OK.");
console.log(JSON.stringify({
  wide: {
    primaryPhaseFraction: wide.primaryPhaseFraction,
    secondaryPhaseFraction: wide.secondaryPhaseFraction,
    combinedPhaseFraction: wide.combinedPhaseFraction,
    reflectedLightFactor: wide.reflectedLightFactor,
  },
  crescent: {
    primaryPhaseFraction: crescent.primaryPhaseFraction,
    secondaryPhaseFraction: crescent.secondaryPhaseFraction,
    combinedPhaseFraction: crescent.combinedPhaseFraction,
    reflectedLightFactor: crescent.reflectedLightFactor,
  },
}, null, 2));
