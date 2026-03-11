import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cases = [
  { preset: "surface-sunrise", name: "lighting-sunrise" },
  { preset: "surface-noon", name: "lighting-noon" },
  { preset: "surface-sunset", name: "lighting-sunset" },
  { preset: "surface-second-sun", name: "lighting-second-sun" },
  { preset: "surface-night", name: "lighting-night" },
];

for (const entry of cases) {
  const result = spawnSync(
    "node",
    ["scripts/headless-render.mjs", "--scene=binarySurface", `--preset=${entry.preset}`, "--hour-rate=0", `--name=${entry.name}`, "--wait-ms=1800"],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readDebug(name) {
  const filePath = path.join(projectRoot, "output", `${name}-debug.json`);
  return JSON.parse(fs.readFileSync(filePath, "utf8")).debug;
}

const sunrise = readDebug("lighting-sunrise");
const noon = readDebug("lighting-noon");
const sunset = readDebug("lighting-sunset");
const secondSun = readDebug("lighting-second-sun");
const night = readDebug("lighting-night");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(sunrise.lighting.primaryAirMass > 5, "Sunrise should have high primary air mass");
assert(noon.lighting.primaryAirMass < 2, "Noon should have low primary air mass");
assert(sunrise.lighting.primaryDirectIlluminance < noon.lighting.primaryDirectIlluminance, "Noon should be brighter than sunrise");
assert(sunrise.lighting.primaryTransmittance < noon.lighting.primaryTransmittance, "Sunrise transmittance should be below noon");
assert(noon.lighting.primaryDirectLux > sunrise.lighting.primaryDirectLux, "Noon direct lux should exceed sunrise");
assert(noon.lighting.primaryDiscLuminance > sunset.lighting.primaryDiscLuminance, "Noon disc luminance should exceed sunset");
assert(sunrise.lighting.hazeFactor > noon.lighting.hazeFactor, "Sunrise haze should exceed noon haze");
assert(sunset.lighting.skyHorizonLuminance > night.lighting.skyHorizonLuminance, "Sunset horizon should be brighter than night horizon");
assert(sunset.lighting.skyHorizonLuminance > sunset.lighting.skyZenithLuminance, "Sunset horizon should dominate sunset zenith");
assert(noon.lighting.skyZenithLuminance > night.lighting.skyZenithLuminance, "Noon zenith should exceed night zenith");
assert(noon.lighting.extinctionBucketR < noon.lighting.extinctionBucketG, "Red extinction bucket should stay below green");
assert(noon.lighting.extinctionBucketG < noon.lighting.extinctionBucketB, "Green extinction bucket should stay below blue");
assert(sunrise.lighting.waterGlitterBlend > night.lighting.waterGlitterBlend, "Sunrise water glitter should exceed night");
assert(sunrise.lighting.primaryReflectionGain > night.lighting.primaryReflectionGain, "Primary reflection gain should exceed night");
assert(sunset.primaryAltitudeDeg > -1.0 && sunset.primaryAltitudeDeg < 1.0, "Sunset preset should place primary star at horizon");
assert(secondSun.secondaryAltitudeDeg > 8, "Second-sun preset should place secondary star above horizon");
assert(secondSun.primaryAltitudeDeg < 0, "Second-sun preset should keep primary star below horizon");
assert(night.lighting.daylightFactor < 0.05, "Night preset should have negligible daylight factor");
assert(night.lighting.exposure < noon.lighting.exposure, "Night exposure should remain below noon exposure");
assert(noon.lighting.primaryLightIntensity > noon.lighting.secondaryLightIntensity, "Primary local light should dominate secondary at noon");

console.log("Lighting regression OK.");
console.log(JSON.stringify({
  sunrise: sunrise.lighting,
  noon: noon.lighting,
  sunset: sunset.lighting,
  secondSun: secondSun.lighting,
  night: night.lighting,
}, null, 2));
