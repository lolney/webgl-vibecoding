import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cases = [
  {
    name: "clocktower-hyper-lift",
    args: ["--scene=clocktower", "--section=1", "--beat=0.45", "--level=0.55"],
  },
  {
    name: "clocktower-strobe-core",
    args: ["--scene=clocktower", "--section=3", "--beat=0.92", "--level=0.88"],
  },
  {
    name: "clocktower-night-glide",
    args: ["--scene=clocktower", "--section=2", "--beat=0.18", "--level=0.2"],
  },
];

for (const entry of cases) {
  const result = spawnSync(
    "node",
    ["scripts/headless-render.mjs", ...entry.args, `--name=${entry.name}`, "--wait-ms=1800"],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readDebug(name) {
  const filePath = path.join(projectRoot, "output", `${name}-debug.json`);
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return {
    ...payload.debug,
    canvasStats: payload.canvasStats || null,
  };
}

const hyperLift = readDebug("clocktower-hyper-lift");
const strobeCore = readDebug("clocktower-strobe-core");
const nightGlide = readDebug("clocktower-night-glide");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(hyperLift.section === 1, "Hyper Lift render should be locked to section 1");
assert(strobeCore.section === 3, "Strobe Core render should be locked to section 3");
assert(nightGlide.section === 2, "Night Glide render should be locked to section 2");
assert(hyperLift.sectionOverride === 1, "Section override should be present in debug state");
assert(strobeCore.sectionOverride === 3, "Strobe Core override should be present in debug state");
assert(hyperLift.lighting.beamIntensity > nightGlide.lighting.beamIntensity, "Hyper Lift beam intensity should exceed Night Glide");
assert(hyperLift.lighting.beamConeOpacity > nightGlide.lighting.beamConeOpacity, "Hyper Lift beam cone should be more visible than Night Glide");
assert(hyperLift.lighting.beamMediumDensity > nightGlide.lighting.beamMediumDensity, "Hyper Lift beam medium density should exceed Night Glide");
assert(strobeCore.lighting.strobeMeanIntensity > hyperLift.lighting.strobeMeanIntensity, "Strobe Core should exceed Hyper Lift mean strobe intensity");
assert(strobeCore.lighting.strobePeakMediumDensity > hyperLift.lighting.strobePeakMediumDensity, "Strobe Core medium density should exceed Hyper Lift");
assert(strobeCore.lighting.strobePeakMediumDensity > nightGlide.lighting.strobePeakMediumDensity, "Strobe Core medium density should exceed Night Glide");
assert(strobeCore.lighting.activeStrobes >= hyperLift.lighting.activeStrobes, "Strobe Core should have at least as many active strobes");
assert(strobeCore.lighting.exposure < hyperLift.lighting.exposure, "Strobe Core exposure should compress below Hyper Lift");
assert(nightGlide.lighting.moonIntensity > 0.6, "Night Glide moon intensity should remain non-trivial");
assert(nightGlide.lighting.moonShaftStrength > 0.15, "Night Glide moon shaft strength should remain non-trivial");
assert(hyperLift.lighting.moonAltitudeDeg > 5, "Moon should remain above the horizon in Hyper Lift");
assert(nightGlide.lighting.moonReflectionStrength > 0.15, "Moon reflection should remain visible in Night Glide");
assert((strobeCore.canvasStats?.leftEdgeBrightRatio ?? 1) < 0.12, "Strobe Core should avoid left-edge beam blowout");
assert((strobeCore.canvasStats?.rightEdgeBrightRatio ?? 1) < 0.12, "Strobe Core should avoid right-edge beam blowout");
assert((nightGlide.canvasStats?.leftEdgeBrightRatio ?? 1) < 0.04, "Night Glide should avoid left-edge blowout");
assert((nightGlide.canvasStats?.rightEdgeBrightRatio ?? 1) < 0.04, "Night Glide should avoid right-edge blowout");

console.log("Clocktower lighting regression OK.");
console.log(JSON.stringify({
  hyperLift: hyperLift.lighting,
  strobeCore: strobeCore.lighting,
  nightGlide: nightGlide.lighting,
}, null, 2));
