import * as THREE from "three";

const PRIMARY_BASE = new THREE.Color(0xfff1cf);
const SECONDARY_BASE = new THREE.Color(0xc9dcff);
const NIGHT_ZENITH = new THREE.Color(0x020712);
const NIGHT_HORIZON = new THREE.Color(0x081428);
const DAY_ZENITH = new THREE.Color(0x2d69b8);
const DAY_HORIZON = new THREE.Color(0x95b7e5);
const TWILIGHT_WARM = new THREE.Color(0xff8c46);
const TWILIGHT_COOL = new THREE.Color(0x4b7bd0);
const RAYLEIGH_BASE = new THREE.Color(0x77b6ff);
const MIE_COOL = new THREE.Color(0xa9c8ff);

const PRIMARY_EXTINCTION = new THREE.Vector3(0.045, 0.082, 0.17);
const SECONDARY_EXTINCTION = new THREE.Vector3(0.052, 0.094, 0.19);

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

function transmittanceFromAirMass(extinction, airMass) {
  return new THREE.Color(
    Math.exp(-extinction.x * airMass),
    Math.exp(-extinction.y * airMass),
    Math.exp(-extinction.z * airMass),
  );
}

function apparentSolarColor(baseColor, transmittance) {
  const color = multiplyColor(baseColor, transmittance);
  const peak = Math.max(color.r, color.g, color.b, 1e-3);
  return color.multiplyScalar(1 / peak);
}

function solarState({
  altitude,
  azimuth,
  localDir,
  weight,
  baseColor,
  extinction,
  haloBoost = 1,
}) {
  const altitudeDeg = THREE.MathUtils.radToDeg(altitude);
  const airMass = airMassFromAltitude(altitude);
  const transmittance = transmittanceFromAirMass(extinction, airMass);
  const apparentColor = apparentSolarColor(baseColor, transmittance);
  const visibleFactor = smoothstep(-4.5, 2.0, altitudeDeg);
  const directFactor = clamp01(Math.sin(Math.max(0, altitude)));
  const horizonFactor = clamp01(1 - smoothstep(0, 0.78, directFactor));
  const scatterFactor = visibleFactor * (0.28 + horizonFactor * 0.72);
  const mieFactor = visibleFactor * (0.22 + horizonFactor * 1.1) * haloBoost;
  const transmittanceLuma = luma(transmittance);
  const directIlluminance = directFactor * weight * transmittanceLuma;
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
    directIlluminance,
    horizonFactor,
    scatterFactor,
    mieFactor,
    discScale: 0.96 + horizonFactor * 0.5,
    discIntensity: visibleFactor * (0.42 + 0.72 * Math.sqrt(transmittanceLuma)),
    haloStrength: visibleFactor * (0.1 + horizonFactor * 0.34 + transmittanceLuma * 0.08) * haloBoost,
    reflectionGain: visibleFactor * (0.12 + horizonFactor * 0.8),
  };
}

export function computeLightingState(orbit) {
  const primary = solarState({
    altitude: orbit.primaryAltitude,
    azimuth: orbit.primaryAzimuth,
    localDir: orbit.primaryLocalDir,
    weight: 1.0,
    baseColor: PRIMARY_BASE,
    extinction: PRIMARY_EXTINCTION,
    haloBoost: 1.0,
  });
  const secondary = solarState({
    altitude: orbit.secondaryAltitude,
    azimuth: orbit.secondaryAzimuth,
    localDir: orbit.secondaryLocalDir,
    weight: 0.42,
    baseColor: SECONDARY_BASE,
    extinction: SECONDARY_EXTINCTION,
    haloBoost: 0.74,
  });

  const directTotal = primary.directIlluminance + secondary.directIlluminance;
  const maxAltitudeDeg = Math.max(primary.altitudeDeg, secondary.altitudeDeg);
  const daylight = clamp01(directTotal * 6.6);
  const twilight = smoothstep(-12, -1.2, maxAltitudeDeg) * (1 - smoothstep(3, 14, maxAltitudeDeg));
  const night = clamp01(1 - daylight * 0.92 - twilight * 0.78);
  const haze = clamp01(0.18 + twilight * 0.52 + primary.horizonFactor * 0.2 + secondary.horizonFactor * 0.12);
  const horizonWarmth = clamp01(
    primary.horizonFactor * primary.visibleFactor * 0.88
      + secondary.horizonFactor * secondary.visibleFactor * 0.34,
  );

  const zenithColor = NIGHT_ZENITH.clone()
    .lerp(TWILIGHT_COOL, twilight * 0.65)
    .lerp(DAY_ZENITH, daylight);
  const horizonColor = NIGHT_HORIZON.clone()
    .lerp(TWILIGHT_WARM, clamp01(twilight + horizonWarmth * 0.4))
    .lerp(DAY_HORIZON, daylight * 0.82);
  const rayleighColor = RAYLEIGH_BASE.clone()
    .lerp(new THREE.Color(0xa6cbff), clamp01(daylight * 0.7 + twilight * 0.3));
  const mieColorA = apparentColorMix(primary.apparentColor, TWILIGHT_WARM, 0.22 + primary.horizonFactor * 0.5);
  const mieColorB = apparentColorMix(secondary.apparentColor, MIE_COOL, 0.45);

  const ambientColor = NIGHT_HORIZON.clone()
    .lerp(horizonColor, twilight * 0.55 + daylight * 0.3)
    .lerp(zenithColor, daylight * 0.42);
  const fogColor = horizonColor.clone().lerp(zenithColor, 0.34 + daylight * 0.18);
  const backgroundColor = fogColor.clone().multiplyScalar(0.78 + daylight * 0.14);
  const exposure = THREE.MathUtils.clamp(0.29 + directTotal * 0.72 + daylight * 0.08 - horizonWarmth * 0.03, 0.26, 0.48);

  const combinedSunDirection = orbit.primaryLocalDir.clone().multiplyScalar(primary.directIlluminance + 0.12)
    .add(orbit.secondaryLocalDir.clone().multiplyScalar(secondary.directIlluminance + 0.04));
  if (combinedSunDirection.lengthSq() < 1e-6) combinedSunDirection.set(0.2, 0.92, 0.34);
  combinedSunDirection.normalize();

  return {
    primary,
    secondary,
    sky: {
      daylight,
      twilight,
      night,
      haze,
      horizonWarmth,
      zenithColor,
      horizonColor,
      nightZenith: NIGHT_ZENITH.clone(),
      nightHorizon: NIGHT_HORIZON.clone(),
      rayleighColor,
      mieColorA,
      mieColorB,
      scatterStrengthA: primary.scatterFactor,
      scatterStrengthB: secondary.scatterFactor * 0.7,
      mieStrengthA: primary.mieFactor,
      mieStrengthB: secondary.mieFactor * 0.85,
      ambientColor,
      fogColor,
      backgroundColor,
      exposure,
      fogDensity: THREE.MathUtils.lerp(0.098, 0.032, daylight),
    },
    surface: {
      combinedSunDirection,
      waterSunColor: apparentColorMix(primary.apparentColor, secondary.apparentColor, 0.18)
        .multiplyScalar(0.14 + directTotal * 0.34),
      farWaterSunColor: apparentColorMix(primary.apparentColor, secondary.apparentColor, 0.26)
        .multiplyScalar(0.18 + directTotal * 0.38),
      nearWaterColor: daylight > 0.35 ? new THREE.Color(0x0a2742) : new THREE.Color(0x07162a),
      farWaterColor: daylight > 0.35 ? new THREE.Color(0x103654) : new THREE.Color(0x0a1d35),
      distortionNear: THREE.MathUtils.lerp(0.44, 0.86, primary.horizonFactor),
      distortionFar: THREE.MathUtils.lerp(0.68, 1.12, primary.horizonFactor),
      sizeNear: THREE.MathUtils.lerp(2.1, 2.7, primary.horizonFactor),
      sizeFar: THREE.MathUtils.lerp(2.7, 3.5, primary.horizonFactor),
    },
    photometric: {
      directTotal,
      ambientLevel: THREE.MathUtils.lerp(0.05, 0.31, daylight) + secondary.directIlluminance * 0.2,
      fillLevel: 0.08 + primary.directIlluminance * 0.38 + secondary.directIlluminance * 0.24,
      starLightA: 18 + primary.directIlluminance * 92 + primary.horizonFactor * 14,
      starLightB: 4 + secondary.directIlluminance * 84 + secondary.horizonFactor * 9,
      atmosphereIntensity: 0.24 + daylight * 0.18 + twilight * 0.08,
      bloomStrength: 0.004 + primary.horizonFactor * 0.014 + secondary.mieFactor * 0.01,
      bloomRadius: 0.02 + haze * 0.016 + secondary.horizonFactor * 0.008,
      bloomThreshold: THREE.MathUtils.lerp(0.9996, 0.988, primary.horizonFactor),
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
    primaryDirectIlluminance: Number(lighting.primary.directIlluminance.toFixed(4)),
    secondaryDirectIlluminance: Number(lighting.secondary.directIlluminance.toFixed(4)),
    daylightFactor: Number(lighting.sky.daylight.toFixed(4)),
    twilightFactor: Number(lighting.sky.twilight.toFixed(4)),
    hazeFactor: Number(lighting.sky.haze.toFixed(4)),
    exposure: Number(lighting.sky.exposure.toFixed(4)),
  };
}
