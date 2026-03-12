import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cases = [
  { preset: "external-eclipse-ingress", name: "eclipse-ingress" },
  { preset: "external-eclipse-totality", name: "eclipse-totality" },
  { preset: "external-eclipse-egress", name: "eclipse-egress" },
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

const ingress = readDebug("eclipse-ingress");
const totality = readDebug("eclipse-totality");
const egress = readDebug("eclipse-egress");

assert(ingress.secondaryStarEclipseFraction > 0.3, "Ingress should materially eclipse the secondary star");
assert(totality.secondaryStarEclipseFraction > ingress.secondaryStarEclipseFraction, "Totality should exceed ingress overlap");
assert(totality.secondaryOcclusionFraction > 0.8, "Totality should heavily occlude the secondary star");
assert(egress.secondaryStarEclipseFraction < totality.secondaryStarEclipseFraction, "Egress should reduce overlap from totality");

console.log("Eclipse regression OK.");
console.log(JSON.stringify({
  ingress: {
    secondaryStarEclipseFraction: ingress.secondaryStarEclipseFraction,
    secondaryOcclusionFraction: ingress.secondaryOcclusionFraction,
  },
  totality: {
    secondaryStarEclipseFraction: totality.secondaryStarEclipseFraction,
    secondaryOcclusionFraction: totality.secondaryOcclusionFraction,
  },
  egress: {
    secondaryStarEclipseFraction: egress.secondaryStarEclipseFraction,
    secondaryOcclusionFraction: egress.secondaryOcclusionFraction,
  },
}, null, 2));
