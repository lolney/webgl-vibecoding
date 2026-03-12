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
  { preset: "surface-summer-solstice", name: "lighting-summer-solstice" },
  { preset: "surface-equinox", name: "lighting-equinox" },
  { preset: "surface-winter-solstice", name: "lighting-winter-solstice" },
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
const summer = readDebug("lighting-summer-solstice");
const equinox = readDebug("lighting-equinox");
const winter = readDebug("lighting-winter-solstice");

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
assert(sunset.lighting.skyHorizonLuminance > sunset.lighting.skyZenithLuminance * 0.95, "Sunset horizon should stay comparable to or above sunset zenith");
assert(noon.lighting.skyZenithLuminance > night.lighting.skyZenithLuminance, "Noon zenith should exceed night zenith");
assert(noon.lighting.skyMultiScatterStrength > night.lighting.skyMultiScatterStrength, "Noon multi-scatter should exceed night");
assert(sunset.lighting.skyMultiScatterStrength > night.lighting.skyMultiScatterStrength, "Sunset multi-scatter should exceed night");
assert(sunset.lighting.skyMultiScatterStrength > 0.25, "Sunset multi-scatter should remain materially present");
assert(noon.lighting.skyHorizonOpticalDepth > noon.lighting.skyZenithOpticalDepth, "Horizon optical depth should exceed zenith optical depth");
assert(sunrise.lighting.skyHorizonOpticalDepth > sunrise.lighting.skyZenithOpticalDepth, "Sunrise horizon optical depth should exceed zenith optical depth");
assert(noon.lighting.extinctionBucketR < noon.lighting.extinctionBucketG, "Red extinction bucket should stay below green");
assert(noon.lighting.extinctionBucketG < noon.lighting.extinctionBucketB, "Green extinction bucket should stay below blue");
assert(sunrise.lighting.waterGlitterBlend > night.lighting.waterGlitterBlend, "Sunrise water glitter should exceed night");
assert(sunrise.lighting.primaryReflectionGain > night.lighting.primaryReflectionGain, "Primary reflection gain should exceed night");
assert(sunrise.lighting.waterFresnel > noon.lighting.waterFresnel, "Sunrise Fresnel should exceed noon");
assert(sunrise.lighting.waterSkyReflectionGain > noon.lighting.waterSkyReflectionGain, "Sunrise sky reflection gain should exceed noon");
assert(sunrise.lighting.primarySpecular > noon.lighting.primarySpecular, "Sunrise primary specular should exceed noon");
assert(sunset.lighting.primaryTrailGain > noon.lighting.primaryTrailGain, "Sunset primary trail gain should exceed noon");
assert(secondSun.lighting.secondaryTrailGain > secondSun.lighting.primaryTrailGain, "Second-sun preset should bias trail gain toward the visible secondary");
assert(secondSun.lighting.primarySpecular > secondSun.lighting.secondarySpecular, "Second-sun preset should bias glint toward the aligned star");
assert(noon.lighting.waterRoughnessFar > noon.lighting.waterRoughnessNear, "Far-water roughness should exceed near-water roughness");
assert(sunrise.lighting.waterGlitterWidth > noon.lighting.waterGlitterWidth, "Sunrise glitter width should exceed noon");
assert(sunset.lighting.surfaceHazeOpacity > noon.lighting.surfaceHazeOpacity, "Sunset haze opacity should exceed noon");
assert(night.lighting.surfaceHazeOpacity < sunset.lighting.surfaceHazeOpacity, "Night haze opacity should stay below sunset");
assert(sunset.lighting.externalFogDensity > noon.lighting.externalFogDensity, "External fog density should rise toward sunset");
assert(sunrise.lighting.primaryShaftStrength > noon.lighting.primaryShaftStrength, "Sunrise shaft strength should exceed noon");
assert(sunset.lighting.secondaryShaftStrength > noon.lighting.secondaryShaftStrength, "Sunset secondary shaft strength should exceed noon");
assert(sunrise.lighting.volumetricMediumDensity > noon.lighting.volumetricMediumDensity, "Sunrise medium density should exceed noon");
assert(sunset.lighting.volumetricMediumDensity > night.lighting.volumetricMediumDensity * 0.9, "Sunset medium density should remain materially present");
assert(night.lighting.primaryShaftStrength < 0.001, "Night primary shaft strength should be negligible");
assert(secondSun.lighting.secondaryShaftStrength > secondSun.lighting.primaryShaftStrength, "Second-sun shafts should favor the visible secondary");
assert(sunset.primaryAltitudeDeg > -1.0 && sunset.primaryAltitudeDeg < 1.0, "Sunset preset should place primary star at horizon");
assert(secondSun.secondaryAltitudeDeg > 8, "Second-sun preset should place secondary star above horizon");
assert(secondSun.primaryAltitudeDeg < 0, "Second-sun preset should keep primary star below horizon");
assert(night.lighting.daylightFactor < 0.05, "Night preset should have negligible daylight factor");
assert(night.lighting.exposure < noon.lighting.exposure, "Night exposure should remain below noon exposure");
assert(noon.lighting.primaryLightIntensity > noon.lighting.secondaryLightIntensity, "Primary local light should dominate secondary at noon");
assert(summer.primaryDeclinationDeg > 10, "Summer solstice should yield materially positive declination");
assert(winter.primaryDeclinationDeg < -10, "Winter solstice should yield materially negative declination");
assert(Math.abs(equinox.primaryDeclinationDeg) < 2.5, "Equinox should keep primary declination near zero");
assert(summer.primaryAltitudeDeg > equinox.primaryAltitudeDeg + 10, "Summer noon altitude should exceed equinox at high latitude");
assert(equinox.primaryAltitudeDeg > winter.primaryAltitudeDeg + 10, "Equinox noon altitude should exceed winter at high latitude");
assert(summer.seasonDay > winter.seasonDay, "Season day should advance monotonically from winter to summer preset");
assert(summer.seasonPhase > winter.seasonPhase, "Season phase should advance monotonically from winter to summer preset");

console.log("Lighting regression OK.");
console.log(JSON.stringify({
  sunrise: sunrise.lighting,
  noon: noon.lighting,
  sunset: sunset.lighting,
  secondSun: secondSun.lighting,
  night: night.lighting,
  summer: {
    seasonDay: summer.seasonDay,
    primaryDeclinationDeg: summer.primaryDeclinationDeg,
    primaryAltitudeDeg: summer.primaryAltitudeDeg,
  },
  equinox: {
    seasonDay: equinox.seasonDay,
    primaryDeclinationDeg: equinox.primaryDeclinationDeg,
    primaryAltitudeDeg: equinox.primaryAltitudeDeg,
  },
  winter: {
    seasonDay: winter.seasonDay,
    primaryDeclinationDeg: winter.primaryDeclinationDeg,
    primaryAltitudeDeg: winter.primaryAltitudeDeg,
  },
}, null, 2));
