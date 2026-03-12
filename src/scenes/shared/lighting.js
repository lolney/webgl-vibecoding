import * as THREE from "three";
import { binaryLightModel } from "./lightModel.js";

const PRIMARY_BASE = new THREE.Color(0xfff1cf);
const SECONDARY_BASE = new THREE.Color(0xc9dcff);
const NIGHT_ZENITH = new THREE.Color(0x020712);
const NIGHT_HORIZON = new THREE.Color(0x081428);
const RAYLEIGH_COEFF = new THREE.Color(0.33, 0.56, 1.0);
const MIE_COEFF = new THREE.Color(1.0, 0.91, 0.76);
const AIR_GLOW_COEFF = new THREE.Color(0.14, 0.2, 0.32);
const MULTI_SCATTER_COEFF = new THREE.Color(0.5, 0.62, 0.94);
const HORIZON_GLOW_COEFF = new THREE.Color(1.0, 0.76, 0.48);
const EXTINCTION_WAVELENGTHS_NM = { r: 680, g: 550, b: 440 };
const RAYLEIGH_EXTINCTION_SCALE = 0.028;
const AEROSOL_EXTINCTION_SCALE = 0.008;

function clamp01(v) {
  return THREE.MathUtils.clamp(v, 0, 1);
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function airMassFromAltitude(altitudeRad) {
  const altitudeDeg = THREE.MathUtils.radToDeg(altitudeRad);
  if (altitudeDeg <= -5) return 40;
  const zenith = THREE.MathUtils.clamp(90 - altitudeDeg, 0, 89.9);
  const denom = Math.cos(THREE.MathUtils.degToRad(zenith))
    + 0.50572 * Math.pow(96.07995 - zenith, -1.6364);
  return THREE.MathUtils.clamp(1 / Math.max(0.01, denom), 1, 40);
}

function luma(color) {
  return (color.r * 0.2126) + (color.g * 0.7152) + (color.b * 0.0722);
}

function multiplyColor(a, b) {
  return new THREE.Color(a.r * b.r, a.g * b.g, a.b * b.b);
}

function wavelengthPower(lambdaNm, exponent) {
  return Math.pow(EXTINCTION_WAVELENGTHS_NM.g / lambdaNm, exponent);
}

function atmosphericExtinctionBuckets() {
  return new THREE.Color(
    RAYLEIGH_EXTINCTION_SCALE * wavelengthPower(EXTINCTION_WAVELENGTHS_NM.r, 4)
      + AEROSOL_EXTINCTION_SCALE * wavelengthPower(EXTINCTION_WAVELENGTHS_NM.r, 1.3),
    RAYLEIGH_EXTINCTION_SCALE * wavelengthPower(EXTINCTION_WAVELENGTHS_NM.g, 4)
      + AEROSOL_EXTINCTION_SCALE * wavelengthPower(EXTINCTION_WAVELENGTHS_NM.g, 1.3),
    RAYLEIGH_EXTINCTION_SCALE * wavelengthPower(EXTINCTION_WAVELENGTHS_NM.b, 4)
      + AEROSOL_EXTINCTION_SCALE * wavelengthPower(EXTINCTION_WAVELENGTHS_NM.b, 1.3),
  );
}

const ATMOSPHERIC_EXTINCTION = atmosphericExtinctionBuckets();

function transmittanceFromAirMass(airMass) {
  return new THREE.Color(
    Math.exp(-ATMOSPHERIC_EXTINCTION.r * airMass),
    Math.exp(-ATMOSPHERIC_EXTINCTION.g * airMass),
    Math.exp(-ATMOSPHERIC_EXTINCTION.b * airMass),
  );
}

function apparentSolarColor(baseColor, transmittance) {
  const color = multiplyColor(baseColor, transmittance);
  const peak = Math.max(color.r, color.g, color.b, 1e-3);
  return color.multiplyScalar(1 / peak);
}

function opticalDepthForView(viewUp, haze) {
  const mu = THREE.MathUtils.clamp(viewUp, 0.02, 1.0);
  const rayleighDepth = 1 / (mu + 0.12);
  const aerosolDepth = 1 / (mu + 0.055);
  return rayleighDepth * (0.4 + haze * 0.08) + aerosolDepth * (0.12 + haze * 0.36);
}

function scaleColor(color, scalar) {
  return color.clone().multiplyScalar(scalar);
}

function schlickFresnel(cosTheta, f0 = 0.02) {
  const m = clamp01(1 - cosTheta);
  return f0 + (1 - f0) * Math.pow(m, 5);
}

function reflectLocal(lightDir, normal = new THREE.Vector3(0, 1, 0)) {
  return lightDir.clone().negate().reflect(normal).normalize();
}

function chromaOrFallback(color, fallback) {
  const peak = Math.max(color.r, color.g, color.b);
  if (peak <= 1e-5) return fallback.clone();
  return color.clone().multiplyScalar(1 / peak);
}

function clampColor(color, maxValue = 1.5) {
  color.r = THREE.MathUtils.clamp(color.r, 0, maxValue);
  color.g = THREE.MathUtils.clamp(color.g, 0, maxValue);
  color.b = THREE.MathUtils.clamp(color.b, 0, maxValue);
  return color;
}

function compressColor(color, shoulder = 1.0) {
  return new THREE.Color(
    color.r / (1 + color.r / shoulder),
    color.g / (1 + color.g / shoulder),
    color.b / (1 + color.b / shoulder),
  );
}

function computeSkyResponse({ daylight, twilight, haze, horizonWarmth, primary, secondary }) {
  const primaryRayleighRadiance = multiplyColor(primary.apparentColor, RAYLEIGH_COEFF)
    .multiplyScalar(primary.scatterFactor * (0.48 + primary.transmittanceLuma * 0.52));
  const secondaryRayleighRadiance = multiplyColor(secondary.apparentColor, RAYLEIGH_COEFF)
    .multiplyScalar(secondary.scatterFactor * (0.42 + secondary.transmittanceLuma * 0.58));
  const rayleighRadiance = primaryRayleighRadiance.clone().add(secondaryRayleighRadiance);

  const primaryMieRadiance = multiplyColor(primary.apparentColor, MIE_COEFF)
    .multiplyScalar(primary.mieFactor * (0.55 + primary.horizonFactor * 0.45));
  const secondaryMieRadiance = multiplyColor(secondary.apparentColor, MIE_COEFF)
    .multiplyScalar(secondary.mieFactor * (0.48 + secondary.horizonFactor * 0.36));
  const mieRadiance = primaryMieRadiance.clone().add(secondaryMieRadiance);

  const zenithOpticalDepth = opticalDepthForView(1.0, haze);
  const horizonOpticalDepth = opticalDepthForView(0.02, haze);
  const transportWeightedSource = primary.apparentColor.clone()
    .multiplyScalar(primary.visibleFactor * (0.2 + primary.transmittanceLuma * 0.8))
    .add(
      secondary.apparentColor.clone()
        .multiplyScalar(secondary.visibleFactor * (0.14 + secondary.transmittanceLuma * 0.62)),
    );
  const multiScatterColor = chromaOrFallback(
    multiplyColor(rayleighRadiance, MULTI_SCATTER_COEFF)
      .add(scaleColor(mieRadiance, 0.32))
      .add(scaleColor(transportWeightedSource, 0.18)),
    rayleighRadiance,
  );
  const multiScatterStrength = clamp01(
    0.03
      + daylight * 0.42
      + twilight * 0.2
      + haze * 0.1
      + luma(rayleighRadiance) * 0.1,
  );
  const zenithMultiScatter = scaleColor(
    multiScatterColor,
    multiScatterStrength * (0.22 + daylight * 0.08 + zenithOpticalDepth * 0.02),
  );
  const horizonMultiScatter = scaleColor(
    multiScatterColor.clone().lerp(HORIZON_GLOW_COEFF, horizonWarmth * 0.38),
    multiScatterStrength * (0.24 + horizonOpticalDepth * 0.016),
  );
  const lowerAtmosphereAbsorption = new THREE.Color(
    Math.exp(-0.11 * horizonOpticalDepth),
    Math.exp(-0.07 * horizonOpticalDepth),
    Math.exp(-0.035 * horizonOpticalDepth),
  );
  const highAtmosphereAbsorption = new THREE.Color(
    Math.exp(-0.045 * zenithOpticalDepth),
    Math.exp(-0.03 * zenithOpticalDepth),
    Math.exp(-0.018 * zenithOpticalDepth),
  );

  const zenithRadiance = scaleColor(rayleighRadiance, 0.94 + daylight * 0.44)
    .add(scaleColor(mieRadiance, 0.06 + haze * 0.03))
    .add(zenithMultiScatter)
    .add(scaleColor(AIR_GLOW_COEFF, daylight * 0.1));
  const horizonRadiance = scaleColor(rayleighRadiance, 0.34 + twilight * 0.18)
    .add(scaleColor(mieRadiance, 0.58 + haze * 0.28))
    .add(horizonMultiScatter)
    .add(scaleColor(primary.apparentColor, primary.horizonFactor * 0.08))
    .add(scaleColor(secondary.apparentColor, secondary.horizonFactor * 0.05));

  const zenithColor = clampColor(
    compressColor(
      NIGHT_ZENITH.clone()
        .add(multiplyColor(zenithRadiance, highAtmosphereAbsorption)),
      1.06,
    ),
    1.0,
  );
  const horizonColor = clampColor(
    compressColor(
      NIGHT_HORIZON.clone()
        .add(multiplyColor(horizonRadiance, lowerAtmosphereAbsorption)),
      1.02,
    ),
    0.94,
  );
  const ambientColor = NIGHT_HORIZON.clone()
    .lerp(horizonColor, twilight * 0.55 + daylight * 0.3)
    .lerp(zenithColor, daylight * 0.42);
  const fogColor = horizonColor.clone().lerp(zenithColor, 0.34 + daylight * 0.18);
  const backgroundColor = fogColor.clone().multiplyScalar(0.78 + daylight * 0.14);

  return {
    rayleighRadiance,
    mieRadiance,
    zenithColor,
    horizonColor,
    ambientColor,
    fogColor,
    backgroundColor,
    rayleighColor: chromaOrFallback(rayleighRadiance, RAYLEIGH_COEFF),
    mieColorA: chromaOrFallback(primaryMieRadiance, primary.apparentColor),
    mieColorB: chromaOrFallback(secondaryMieRadiance, secondary.apparentColor),
    multiScatterColor,
    multiScatterStrength,
    scatterStrengthA: primary.scatterFactor,
    scatterStrengthB: secondary.scatterFactor * 0.7,
    mieStrengthA: primary.mieFactor,
    mieStrengthB: secondary.mieFactor * 0.85,
    fogDensity: THREE.MathUtils.lerp(0.098, 0.032, daylight),
    horizonWarmth,
    zenithOpticalDepth,
    horizonOpticalDepth,
  };
}

function computeSurfaceResponse({ transport, skyResponse, primary, secondary, orbit }) {
  const surfaceNormal = new THREE.Vector3(0, 1, 0);
  const viewToEye = orbit.lookLocal.clone().negate().normalize();
  const viewCosSurface = clamp01(Math.abs(orbit.lookLocal.y));
  const waterFresnel = schlickFresnel(viewCosSurface, 0.021);
  const primaryReflectionDir = reflectLocal(orbit.primaryLocalDir, surfaceNormal);
  const secondaryReflectionDir = reflectLocal(orbit.secondaryLocalDir, surfaceNormal);
  const roughnessNear = THREE.MathUtils.clamp(
    0.08 + transport.haze * 0.07 + transport.twilight * 0.05 + waterFresnel * 0.04,
    0.08,
    0.24,
  );
  const roughnessFar = THREE.MathUtils.clamp(roughnessNear + 0.08 + transport.twilight * 0.04, 0.16, 0.34);
  const primarySpecular = Math.pow(
    Math.max(0, primaryReflectionDir.dot(viewToEye)),
    THREE.MathUtils.lerp(180, 24, roughnessNear),
  );
  const secondarySpecular = Math.pow(
    Math.max(0, secondaryReflectionDir.dot(viewToEye)),
    THREE.MathUtils.lerp(180, 24, roughnessNear),
  );
  const combinedSunDirection = orbit.primaryLocalDir.clone().multiplyScalar(primary.directIlluminanceLux + 2000)
    .add(orbit.secondaryLocalDir.clone().multiplyScalar(secondary.directIlluminanceLux + 1200));
  if (combinedSunDirection.lengthSq() < 1e-6) combinedSunDirection.set(0.2, 0.92, 0.34);
  combinedSunDirection.normalize();

  const primaryTrailGain = primary.visibleFactor
    * primary.reflectionGain
    * waterFresnel
    * (0.08 + primarySpecular * 2.4);
  const secondaryTrailGain = secondary.visibleFactor
    * secondary.reflectionGain
    * waterFresnel
    * (0.06 + secondarySpecular * 2.15);
  const primaryGlitter = primaryTrailGain * (0.52 + primary.horizonFactor * 0.42);
  const secondaryGlitter = secondaryTrailGain * (0.48 + secondary.horizonFactor * 0.38);
  const glitterBlend = clamp01(primaryGlitter + secondaryGlitter * 0.82);
  const skyReflectionGain = clamp01(
    THREE.MathUtils.lerp(0.12, 0.84, waterFresnel)
      * (0.28 + transport.daylight * 0.36 + transport.twilight * 0.28 + transport.haze * 0.14),
  );
  const horizonReflectColor = skyResponse.horizonColor.clone()
    .lerp(skyResponse.multiScatterColor, transport.twilight * 0.25);
  const zenithReflectColor = skyResponse.zenithColor.clone()
    .lerp(skyResponse.multiScatterColor, transport.daylight * 0.14);
  const nearWaterBase = new THREE.Color(0x04111b)
    .lerp(new THREE.Color(0x08243a), transport.daylight * 0.75 + transport.twilight * 0.25);
  const farWaterBase = new THREE.Color(0x071a29)
    .lerp(new THREE.Color(0x113852), transport.daylight * 0.72 + transport.twilight * 0.28);
  const nearWaterColor = nearWaterBase.clone().lerp(
    zenithReflectColor.clone().lerp(horizonReflectColor, 0.68),
    skyReflectionGain * 0.34,
  );
  const farWaterColor = farWaterBase.clone().lerp(
    horizonReflectColor.clone().lerp(zenithReflectColor, 0.22),
    skyReflectionGain * 0.6,
  );
  const primarySpecGain = primaryTrailGain;
  const secondarySpecGain = secondaryTrailGain;
  const waterSunColor = apparentColorMix(primary.apparentColor, secondary.apparentColor, 0.18)
    .multiplyScalar(0.02 + primarySpecGain * 0.9 + secondarySpecGain * 0.52);
  const farWaterSunColor = apparentColorMix(primary.apparentColor, secondary.apparentColor, 0.26)
    .multiplyScalar(0.03 + primarySpecGain * 1.18 + secondarySpecGain * 0.72);
  const glitterWidth = THREE.MathUtils.lerp(0.16, 0.62, roughnessFar + waterFresnel * 0.18);

  return {
    combinedSunDirection,
    primaryGlitter,
    secondaryGlitter,
    glitterBlend,
    waterSunColor,
    farWaterSunColor,
    nearWaterColor,
    farWaterColor,
    distortionNear: THREE.MathUtils.lerp(0.22, 0.46, roughnessNear + skyReflectionGain * 0.12),
    distortionFar: THREE.MathUtils.lerp(0.32, 0.64, roughnessFar + skyReflectionGain * 0.18),
    sizeNear: THREE.MathUtils.lerp(1.45, 1.95, roughnessNear + skyReflectionGain * 0.08),
    sizeFar: THREE.MathUtils.lerp(2.05, 2.7, roughnessFar + skyReflectionGain * 0.12),
    scatterBandColor: horizonReflectColor.clone()
      .lerp(apparentColorMix(primary.apparentColor, secondary.apparentColor, 0.24), 0.22),
    scatterBandOpacity: clamp01(
      (0.006 + skyReflectionGain * 0.018 + waterFresnel * 0.016)
      * (0.16 + primary.horizonFactor * 0.34 + secondary.horizonFactor * 0.16 + transport.twilight * 0.22),
    ),
    scatterBandDistance: THREE.MathUtils.lerp(88, 126, skyReflectionGain),
    scatterBandHeight: THREE.MathUtils.lerp(5.0, 10.8, skyReflectionGain + transport.twilight * 0.18),
    waterFresnel,
    skyReflectionGain,
    primarySpecular,
    secondarySpecular,
    primaryTrailGain,
    secondaryTrailGain,
    roughnessNear,
    roughnessFar,
    glitterWidth,
  };
}

function computeAerialPerspective({ transport, skyResponse }) {
  const horizonLift = clamp01(
    transport.twilight * 1.05
      + transport.horizonWarmth * 0.72
      + transport.daylight * 0.16,
  );
  const litHaze = clamp01(
    transport.twilight * 0.9
      + transport.horizonWarmth * 0.58
      + transport.daylight * 0.12,
  );
  const surfaceHazeColor = skyResponse.horizonColor.clone().lerp(skyResponse.zenithColor, 0.18);
  const externalHazeColor = skyResponse.zenithColor.clone().lerp(skyResponse.horizonColor, 0.42);
  const clocktowerHazeColor = skyResponse.horizonColor.clone().multiplyScalar(0.24).add(new THREE.Color(0x07101d));

  return {
    surface: {
      hazeColor: surfaceHazeColor,
      hazeOpacity: THREE.MathUtils.lerp(0.018, 0.105, litHaze),
      hazeDistance: THREE.MathUtils.lerp(100, 138, litHaze),
      hazeHeight: THREE.MathUtils.lerp(12, 19, horizonLift),
      farAlpha: THREE.MathUtils.lerp(0.9, 0.72, horizonLift),
    },
    external: {
      fogColor: externalHazeColor,
      fogDensity: THREE.MathUtils.lerp(0.011, 0.02, litHaze),
      nebulaOpacity: THREE.MathUtils.lerp(0.12, 0.22, litHaze),
      atmosphereBoost: THREE.MathUtils.lerp(0.18, 0.3, litHaze),
    },
    clocktower: {
      fogColor: clocktowerHazeColor,
      fogDensity: THREE.MathUtils.lerp(0.055, 0.074, litHaze),
      farWaterAlpha: THREE.MathUtils.lerp(0.84, 0.68, horizonLift),
    },
  };
}

function computeVolumetrics({ transport, primary, secondary }) {
  const atmosphericVisibility = clamp01(
    transport.twilight * 0.92
      + transport.haze * 0.34
      + transport.daylight * 0.08,
  );
  const mediumDensity = clamp01(
    0.08
      + transport.haze * 0.58
      + transport.twilight * 0.22
      + Math.max(primary.horizonFactor, secondary.horizonFactor * 0.84) * 0.1,
  );
  const primaryStrength = primary.visibleFactor
    * atmosphericVisibility
    * Math.pow(primary.horizonFactor, 1.15)
    * (0.28 + primary.transmittanceLuma * 0.34);
  const secondaryStrength = secondary.visibleFactor
    * atmosphericVisibility
    * Math.pow(secondary.horizonFactor, 1.2)
    * (0.2 + secondary.transmittanceLuma * 0.24)
    * 0.84;

  return {
    primaryShaftStrength: primaryStrength,
    secondaryShaftStrength: secondaryStrength,
    primaryLength: THREE.MathUtils.lerp(18, 44, clamp01(primaryStrength * 1.2)),
    secondaryLength: THREE.MathUtils.lerp(16, 34, clamp01(secondaryStrength * 1.5)),
    primaryRadius: THREE.MathUtils.lerp(4.0, 9.5, clamp01(primaryStrength * 1.2)),
    secondaryRadius: THREE.MathUtils.lerp(3.2, 7.4, clamp01(secondaryStrength * 1.5)),
    atmosphericVisibility,
    mediumDensity,
    anisotropy: THREE.MathUtils.lerp(0.42, 0.76, clamp01(transport.haze * 0.8 + transport.twilight * 0.3)),
  };
}

function solarState({
  altitude,
  azimuth,
  localDir,
  sourceModel,
  baseColor,
  haloBoost = 1,
}) {
  const altitudeDeg = THREE.MathUtils.radToDeg(altitude);
  const airMass = airMassFromAltitude(altitude);
  const transmittance = transmittanceFromAirMass(airMass);
  const apparentColor = apparentSolarColor(baseColor, transmittance);
  const visibleFactor = smoothstep(-4.5, 2.0, altitudeDeg);
  const directFactor = clamp01(Math.sin(Math.max(0, altitude)));
  const horizonFactor = clamp01(1 - smoothstep(0, 0.78, directFactor));
  const scatterFactor = visibleFactor * (0.28 + horizonFactor * 0.72);
  const mieFactor = visibleFactor * (0.22 + horizonFactor * 1.1) * haloBoost;
  const transmittanceLuma = luma(transmittance);
  const directIlluminanceLux = directFactor * sourceModel.topOfAtmosphereLux * transmittanceLuma;
  const discLuminance = visibleFactor * sourceModel.visibleDiscLuminance * (0.42 + 0.72 * Math.sqrt(transmittanceLuma));
  const haloLuminance = visibleFactor
    * sourceModel.haloLuminance
    * (0.1 + horizonFactor * 0.34 + transmittanceLuma * 0.08)
    * haloBoost;
  const localLightIntensity = visibleFactor * (
    sourceModel.localLightBias
    + directIlluminanceLux * sourceModel.localLightIntensityScale
    + horizonFactor * sourceModel.localLightBias * 0.45
  );
  return {
    altitude,
    altitudeDeg,
    azimuth,
    azimuthDeg: THREE.MathUtils.radToDeg(azimuth),
    localDir,
    airMass,
    transmittance,
    transmittanceLuma,
    apparentColor,
    visibleFactor,
    directFactor,
    directIlluminanceLux,
    horizonFactor,
    scatterFactor: scatterFactor * sourceModel.atmosphereScatterScale,
    mieFactor: mieFactor * sourceModel.atmosphereScatterScale,
    discScale: 0.96 + horizonFactor * 0.5,
    discLuminance,
    haloLuminance,
    discIntensity: discLuminance,
    haloStrength: haloLuminance,
    localLightIntensity,
    reflectionGain: visibleFactor * (0.12 + horizonFactor * 0.8),
  };
}

export function computeLightingState(orbit) {
  const primary = solarState({
    altitude: orbit.primaryAltitude,
    azimuth: orbit.primaryAzimuth,
    localDir: orbit.primaryLocalDir,
    sourceModel: binaryLightModel.primaryStar,
    baseColor: PRIMARY_BASE,
    haloBoost: 1.0,
  });
  const secondary = solarState({
    altitude: orbit.secondaryAltitude,
    azimuth: orbit.secondaryAzimuth,
    localDir: orbit.secondaryLocalDir,
    sourceModel: binaryLightModel.secondaryStar,
    baseColor: SECONDARY_BASE,
    haloBoost: 0.74,
  });

  const directTotalLux = primary.directIlluminanceLux + secondary.directIlluminanceLux;
  const maxAltitudeDeg = Math.max(primary.altitudeDeg, secondary.altitudeDeg);
  const daylight = smoothstep(1_500, 18_000, directTotalLux);
  const twilight = smoothstep(-12, -1.2, maxAltitudeDeg) * (1 - smoothstep(3, 14, maxAltitudeDeg));
  const night = clamp01(1 - daylight * 0.92 - twilight * 0.78);
  const haze = clamp01(0.18 + twilight * 0.52 + primary.horizonFactor * 0.2 + secondary.horizonFactor * 0.12);
  const horizonWarmth = clamp01(
    primary.horizonFactor * primary.visibleFactor * 0.88
      + secondary.horizonFactor * secondary.visibleFactor * 0.34,
  );
  const exposure = THREE.MathUtils.clamp(
    0.285 + daylight * 0.17 - horizonWarmth * 0.055 - twilight * 0.04,
    0.25,
    0.46,
  );

  const ambientLux = THREE.MathUtils.lerp(
    binaryLightModel.ambientBounce.nightLux,
    binaryLightModel.ambientBounce.dayLux,
    daylight,
  ) + secondary.directIlluminanceLux * binaryLightModel.ambientBounce.secondaryBounceScale / 10_000;
  const fillLux = binaryLightModel.fillBounce.baseLux
    + primary.directIlluminanceLux * binaryLightModel.fillBounce.primaryScale / 10_000
    + secondary.directIlluminanceLux * binaryLightModel.fillBounce.secondaryScale / 10_000;
  const transport = {
    primaryAirMass: primary.airMass,
    secondaryAirMass: secondary.airMass,
    primaryTransmittance: primary.transmittanceLuma,
    secondaryTransmittance: secondary.transmittanceLuma,
    daylight,
    twilight,
    night,
    haze,
    horizonWarmth,
  };
  const skyResponse = computeSkyResponse({
    daylight,
    twilight,
    haze,
    horizonWarmth,
    primary,
    secondary,
  });
  const surfaceResponse = computeSurfaceResponse({
    transport,
    skyResponse,
    primary,
    secondary,
    orbit,
  });
  const aerialPerspective = computeAerialPerspective({
    transport,
    skyResponse,
  });
  const volumetrics = computeVolumetrics({
    transport,
    primary,
    secondary,
  });

  return {
    primary,
    secondary,
    sourceUnits: {
      primaryTopOfAtmosphereLux: binaryLightModel.primaryStar.topOfAtmosphereLux,
      secondaryTopOfAtmosphereLux: binaryLightModel.secondaryStar.topOfAtmosphereLux,
      primaryDiscLuminance: primary.discLuminance,
      secondaryDiscLuminance: secondary.discLuminance,
      primaryHaloLuminance: primary.haloLuminance,
      secondaryHaloLuminance: secondary.haloLuminance,
    },
    transport,
    illumination: {
      directTotalLux,
      primaryDirectLux: primary.directIlluminanceLux,
      secondaryDirectLux: secondary.directIlluminanceLux,
      ambientLux,
      fillLux,
      primaryLightIntensity: primary.localLightIntensity,
      secondaryLightIntensity: secondary.localLightIntensity,
      atmosphereIntensity: binaryLightModel.atmosphere.baseIntensity
        + daylight * binaryLightModel.atmosphere.daylightGain
        + twilight * binaryLightModel.atmosphere.twilightGain,
    },
    skyResponse: {
      zenithColor: skyResponse.zenithColor,
      horizonColor: skyResponse.horizonColor,
      nightZenith: NIGHT_ZENITH.clone(),
      nightHorizon: NIGHT_HORIZON.clone(),
      rayleighColor: skyResponse.rayleighColor,
      mieColorA: skyResponse.mieColorA,
      mieColorB: skyResponse.mieColorB,
      multiScatterColor: skyResponse.multiScatterColor,
      multiScatterStrength: skyResponse.multiScatterStrength,
      scatterStrengthA: skyResponse.scatterStrengthA,
      scatterStrengthB: skyResponse.scatterStrengthB,
      mieStrengthA: skyResponse.mieStrengthA,
      mieStrengthB: skyResponse.mieStrengthB,
      zenithOpticalDepth: skyResponse.zenithOpticalDepth,
      horizonOpticalDepth: skyResponse.horizonOpticalDepth,
      ambientColor: skyResponse.ambientColor,
      fogColor: skyResponse.fogColor,
      backgroundColor: skyResponse.backgroundColor,
      fogDensity: skyResponse.fogDensity,
      zenithLuminance: luma(skyResponse.zenithColor),
      horizonLuminance: luma(skyResponse.horizonColor),
    },
    surfaceResponse,
    surfaceOptics: {
      primaryReflectionGain: primary.reflectionGain,
      secondaryReflectionGain: secondary.reflectionGain,
    },
    aerialPerspective,
    volumetrics,
    display: {
      bloomStrength: 0.003 + primary.horizonFactor * 0.006 + secondary.mieFactor * 0.005,
      bloomRadius: 0.018 + haze * 0.01 + secondary.horizonFactor * 0.005,
      bloomThreshold: THREE.MathUtils.lerp(
        0.9997,
        0.9962,
        Math.max(primary.horizonFactor, secondary.horizonFactor * 0.75),
      ),
      exposure,
    },
  };
}

function apparentColorMix(a, b, t) {
  return a.clone().lerp(b, t);
}

export function lightingDebugState(lighting) {
  return {
    primaryAirMass: Number(lighting.primary.airMass.toFixed(3)),
    secondaryAirMass: Number(lighting.secondary.airMass.toFixed(3)),
    primaryDirectIlluminance: Number((lighting.illumination.primaryDirectLux / 100000).toFixed(4)),
    secondaryDirectIlluminance: Number((lighting.illumination.secondaryDirectLux / 100000).toFixed(4)),
    primaryDirectLux: Number(lighting.illumination.primaryDirectLux.toFixed(1)),
    secondaryDirectLux: Number(lighting.illumination.secondaryDirectLux.toFixed(1)),
    ambientLux: Number(lighting.illumination.ambientLux.toFixed(4)),
    fillLux: Number(lighting.illumination.fillLux.toFixed(4)),
    extinctionBucketR: Number(ATMOSPHERIC_EXTINCTION.r.toFixed(4)),
    extinctionBucketG: Number(ATMOSPHERIC_EXTINCTION.g.toFixed(4)),
    extinctionBucketB: Number(ATMOSPHERIC_EXTINCTION.b.toFixed(4)),
    skyZenithLuminance: Number(lighting.skyResponse.zenithLuminance.toFixed(4)),
    skyHorizonLuminance: Number(lighting.skyResponse.horizonLuminance.toFixed(4)),
    skyMultiScatterStrength: Number(lighting.skyResponse.multiScatterStrength.toFixed(4)),
    skyZenithOpticalDepth: Number(lighting.skyResponse.zenithOpticalDepth.toFixed(4)),
    skyHorizonOpticalDepth: Number(lighting.skyResponse.horizonOpticalDepth.toFixed(4)),
    primaryDiscLuminance: Number(lighting.sourceUnits.primaryDiscLuminance.toFixed(3)),
    secondaryDiscLuminance: Number(lighting.sourceUnits.secondaryDiscLuminance.toFixed(3)),
    primaryHaloLuminance: Number(lighting.sourceUnits.primaryHaloLuminance.toFixed(3)),
    secondaryHaloLuminance: Number(lighting.sourceUnits.secondaryHaloLuminance.toFixed(3)),
    primaryTransmittance: Number(lighting.transport.primaryTransmittance.toFixed(4)),
    secondaryTransmittance: Number(lighting.transport.secondaryTransmittance.toFixed(4)),
    primaryReflectionGain: Number(lighting.surfaceOptics.primaryReflectionGain.toFixed(4)),
    secondaryReflectionGain: Number(lighting.surfaceOptics.secondaryReflectionGain.toFixed(4)),
    waterGlitterBlend: Number(lighting.surfaceResponse.glitterBlend.toFixed(4)),
    waterFresnel: Number(lighting.surfaceResponse.waterFresnel.toFixed(4)),
    waterSkyReflectionGain: Number(lighting.surfaceResponse.skyReflectionGain.toFixed(4)),
    primarySpecular: Number(lighting.surfaceResponse.primarySpecular.toFixed(4)),
    secondarySpecular: Number(lighting.surfaceResponse.secondarySpecular.toFixed(4)),
    primaryTrailGain: Number(lighting.surfaceResponse.primaryTrailGain.toFixed(4)),
    secondaryTrailGain: Number(lighting.surfaceResponse.secondaryTrailGain.toFixed(4)),
    waterRoughnessNear: Number(lighting.surfaceResponse.roughnessNear.toFixed(4)),
    waterRoughnessFar: Number(lighting.surfaceResponse.roughnessFar.toFixed(4)),
    waterGlitterWidth: Number(lighting.surfaceResponse.glitterWidth.toFixed(4)),
    surfaceHazeOpacity: Number(lighting.aerialPerspective.surface.hazeOpacity.toFixed(4)),
    externalFogDensity: Number(lighting.aerialPerspective.external.fogDensity.toFixed(4)),
    primaryShaftStrength: Number(lighting.volumetrics.primaryShaftStrength.toFixed(4)),
    secondaryShaftStrength: Number(lighting.volumetrics.secondaryShaftStrength.toFixed(4)),
    volumetricMediumDensity: Number(lighting.volumetrics.mediumDensity.toFixed(4)),
    volumetricAnisotropy: Number(lighting.volumetrics.anisotropy.toFixed(4)),
    primaryLightIntensity: Number(lighting.illumination.primaryLightIntensity.toFixed(3)),
    secondaryLightIntensity: Number(lighting.illumination.secondaryLightIntensity.toFixed(3)),
    daylightFactor: Number(lighting.transport.daylight.toFixed(4)),
    twilightFactor: Number(lighting.transport.twilight.toFixed(4)),
    hazeFactor: Number(lighting.transport.haze.toFixed(4)),
    exposure: Number(lighting.display.exposure.toFixed(4)),
    bloomStrength: Number(lighting.display.bloomStrength.toFixed(4)),
  };
}
