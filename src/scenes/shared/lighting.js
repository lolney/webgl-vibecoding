import * as THREE from "three";
import { binaryLightModel } from "./lightModel.js";

const PRIMARY_BASE = new THREE.Color(0xfff1cf);
const SECONDARY_BASE = new THREE.Color(0xc9dcff);
const NIGHT_ZENITH = new THREE.Color(0x020712);
const NIGHT_HORIZON = new THREE.Color(0x081428);
const RAYLEIGH_COEFF = new THREE.Color(0.33, 0.56, 1.0);
const MIE_COEFF = new THREE.Color(1.0, 0.91, 0.76);
const AIR_GLOW_COEFF = new THREE.Color(0.14, 0.2, 0.32);
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

  const zenithRadiance = scaleColor(rayleighRadiance, 0.82 + daylight * 0.28)
    .add(scaleColor(mieRadiance, 0.08 + haze * 0.04))
    .add(scaleColor(AIR_GLOW_COEFF, daylight * 0.06));
  const horizonRadiance = scaleColor(rayleighRadiance, 0.34 + twilight * 0.18)
    .add(scaleColor(mieRadiance, 0.92 + haze * 0.52))
    .add(scaleColor(primary.apparentColor, primary.horizonFactor * 0.14))
    .add(scaleColor(secondary.apparentColor, secondary.horizonFactor * 0.08));

  const zenithColor = clampColor(NIGHT_ZENITH.clone().add(zenithRadiance), 1.2);
  const horizonColor = clampColor(NIGHT_HORIZON.clone().add(horizonRadiance), 1.25);
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
    scatterStrengthA: primary.scatterFactor,
    scatterStrengthB: secondary.scatterFactor * 0.7,
    mieStrengthA: primary.mieFactor,
    mieStrengthB: secondary.mieFactor * 0.85,
    fogDensity: THREE.MathUtils.lerp(0.098, 0.032, daylight),
    horizonWarmth,
  };
}

function computeSurfaceResponse({ daylight, primary, secondary, orbit }) {
  const surfaceNormal = new THREE.Vector3(0, 1, 0);
  const viewToEye = orbit.lookLocal.clone().negate().normalize();
  const viewCosSurface = clamp01(Math.abs(orbit.lookLocal.y));
  const waterFresnel = schlickFresnel(viewCosSurface, 0.021);
  const primaryReflectionDir = reflectLocal(orbit.primaryLocalDir, surfaceNormal);
  const secondaryReflectionDir = reflectLocal(orbit.secondaryLocalDir, surfaceNormal);
  const roughnessNear = 0.18;
  const roughnessFar = 0.26;
  const primarySpecular = Math.pow(
    Math.max(0, primaryReflectionDir.dot(viewToEye)),
    THREE.MathUtils.lerp(72, 18, roughnessNear),
  );
  const secondarySpecular = Math.pow(
    Math.max(0, secondaryReflectionDir.dot(viewToEye)),
    THREE.MathUtils.lerp(72, 18, roughnessNear),
  );
  const combinedSunDirection = orbit.primaryLocalDir.clone().multiplyScalar(primary.directIlluminanceLux + 2000)
    .add(orbit.secondaryLocalDir.clone().multiplyScalar(secondary.directIlluminanceLux + 1200));
  if (combinedSunDirection.lengthSq() < 1e-6) combinedSunDirection.set(0.2, 0.92, 0.34);
  combinedSunDirection.normalize();

  const primaryGlitter = primary.visibleFactor * waterFresnel * (0.12 + primarySpecular * 1.8);
  const secondaryGlitter = secondary.visibleFactor * waterFresnel * (0.1 + secondarySpecular * 1.6);
  const glitterBlend = clamp01(primaryGlitter + secondaryGlitter * 0.82);
  const skyReflectivity = THREE.MathUtils.lerp(0.08, 0.42, waterFresnel);
  const nearWaterBase = daylight > 0.35 ? new THREE.Color(0x08243a) : new THREE.Color(0x061321);
  const farWaterBase = daylight > 0.35 ? new THREE.Color(0x0d314b) : new THREE.Color(0x08192b);
  const skyTintNear = new THREE.Color(0x6f94bc).multiplyScalar(skyReflectivity * (0.1 + daylight * 0.14));
  const skyTintFar = new THREE.Color(0x90b1d8).multiplyScalar(skyReflectivity * (0.18 + daylight * 0.18));
  const primarySpecGain = primary.visibleFactor * waterFresnel * primarySpecular;
  const secondarySpecGain = secondary.visibleFactor * waterFresnel * secondarySpecular;

  return {
    combinedSunDirection,
    primaryGlitter,
    secondaryGlitter,
    glitterBlend,
    waterSunColor: apparentColorMix(primary.apparentColor, secondary.apparentColor, 0.18)
      .multiplyScalar(0.05 + (primarySpecGain + secondarySpecGain * 0.65) * 3.6),
    farWaterSunColor: apparentColorMix(primary.apparentColor, secondary.apparentColor, 0.26)
      .multiplyScalar(0.06 + (primarySpecGain + secondarySpecGain * 0.72) * 4.2),
    nearWaterColor: nearWaterBase.add(skyTintNear),
    farWaterColor: farWaterBase.add(skyTintFar),
    distortionNear: THREE.MathUtils.lerp(0.28, 0.58, roughnessNear + waterFresnel * 0.22),
    distortionFar: THREE.MathUtils.lerp(0.42, 0.82, roughnessFar + waterFresnel * 0.18),
    sizeNear: THREE.MathUtils.lerp(1.6, 2.15, roughnessNear + waterFresnel * 0.18),
    sizeFar: THREE.MathUtils.lerp(2.2, 2.95, roughnessFar + waterFresnel * 0.16),
    waterFresnel,
    primarySpecular,
    secondarySpecular,
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
  const exposure = THREE.MathUtils.clamp(0.29 + daylight * 0.19 - horizonWarmth * 0.03, 0.26, 0.48);

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
    daylight,
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
      scatterStrengthA: skyResponse.scatterStrengthA,
      scatterStrengthB: skyResponse.scatterStrengthB,
      mieStrengthA: skyResponse.mieStrengthA,
      mieStrengthB: skyResponse.mieStrengthB,
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
      bloomStrength: 0.004 + primary.horizonFactor * 0.014 + secondary.mieFactor * 0.01,
      bloomRadius: 0.02 + haze * 0.016 + secondary.horizonFactor * 0.008,
      bloomThreshold: THREE.MathUtils.lerp(0.9996, 0.988, primary.horizonFactor),
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
    primarySpecular: Number(lighting.surfaceResponse.primarySpecular.toFixed(4)),
    secondarySpecular: Number(lighting.surfaceResponse.secondarySpecular.toFixed(4)),
    surfaceHazeOpacity: Number(lighting.aerialPerspective.surface.hazeOpacity.toFixed(4)),
    externalFogDensity: Number(lighting.aerialPerspective.external.fogDensity.toFixed(4)),
    primaryShaftStrength: Number(lighting.volumetrics.primaryShaftStrength.toFixed(4)),
    secondaryShaftStrength: Number(lighting.volumetrics.secondaryShaftStrength.toFixed(4)),
    primaryLightIntensity: Number(lighting.illumination.primaryLightIntensity.toFixed(3)),
    secondaryLightIntensity: Number(lighting.illumination.secondaryLightIntensity.toFixed(3)),
    daylightFactor: Number(lighting.transport.daylight.toFixed(4)),
    twilightFactor: Number(lighting.transport.twilight.toFixed(4)),
    hazeFactor: Number(lighting.transport.haze.toFixed(4)),
    exposure: Number(lighting.display.exposure.toFixed(4)),
    bloomStrength: Number(lighting.display.bloomStrength.toFixed(4)),
  };
}
