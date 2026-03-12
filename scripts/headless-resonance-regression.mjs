import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cases = [
  { preset: "external-wide", name: "resonance-lock" },
  { preset: "external-crescent", name: "resonance-drift" },
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
  return JSON.parse(fs.readFileSync(path.join(projectRoot, "output", `${name}-debug.json`), "utf8")).debug;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const lock = readDebug("resonance-lock");
const drift = readDebug("resonance-drift");

assert(lock.resonanceLabel === "13:2", "Resonance label should be 13:2");
assert(lock.resonanceStrength > 0.95, "External wide preset should land near resonance lock");
assert(drift.resonanceStrength < 0.7, "External crescent preset should drift away from resonance lock");
assert(lock.resonanceStrength > drift.resonanceStrength, "Lock preset should exceed drift preset resonance strength");

console.log("Resonance regression OK.");
console.log(JSON.stringify({
  lock: {
    resonanceLabel: lock.resonanceLabel,
    resonanceStrength: lock.resonanceStrength,
    resonancePhaseDeg: lock.resonancePhaseDeg,
  },
  drift: {
    resonanceLabel: drift.resonanceLabel,
    resonanceStrength: drift.resonanceStrength,
    resonancePhaseDeg: drift.resonancePhaseDeg,
  },
}, null, 2));
