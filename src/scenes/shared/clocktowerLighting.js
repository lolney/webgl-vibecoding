import * as THREE from "three";
import { clocktowerLightModel } from "./lightModel.js";

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
}

function smoothPulse(phase, exponent) {
  return Math.pow(Math.max(0, Math.sin(phase)), exponent);
}

function airMassFromAltitudeDeg(altitudeDeg) {
  if (altitudeDeg <= -5) return 40;
  const zenith = THREE.MathUtils.clamp(90 - altitudeDeg, 0, 89.9);
  const denom = Math.cos(THREE.MathUtils.degToRad(zenith))
    + 0.50572 * Math.pow(96.07995 - zenith, -1.6364);
  return THREE.MathUtils.clamp(1 / Math.max(0.01, denom), 1, 40);
}

function schlickFresnel(cosTheta, f0 = 0.02) {
  const m = clamp01(1 - cosTheta);
  return f0 + (1 - f0) * Math.pow(m, 5);
}

export function computeClocktowerLightingState({ t, beat, level, section, strobeCount }) {
  const sectionBoost = section === 1
    ? clocktowerLightModel.sectionBoost.sectionOne
    : section === 3
      ? clocktowerLightModel.sectionBoost.sectionThree
      : clocktowerLightModel.sectionBoost.default;
  const pulse = 0.45 + level * 0.85 + beat * 1.2;
  const haze = clamp01(
    0.16
      + level * 0.22
      + beat * 0.14
      + (section === 1 ? 0.08 : 0)
      + (section === 3 ? 0.16 : 0),
  );

  const keyIntensity = (
    clocktowerLightModel.key.baseIntensity
    + Math.sin(t * 1.25) * clocktowerLightModel.key.swingIntensity
    + level * clocktowerLightModel.key.levelGain
    + (section === 2 ? clocktowerLightModel.key.sectionTwoBoost : 0)
  ) * (0.92 + haze * 0.08);

  const moonIntensity = clocktowerLightModel.moon.baseIntensity
    + Math.sin(t * 0.4) * clocktowerLightModel.moon.swingIntensity
    + level * clocktowerLightModel.moon.levelGain;

  const beamSectionScale = section === 3 ? 0.68 : 1.0;
  const beamIntensity = (
    clocktowerLightModel.beam.baseIntensity
    + pulse * clocktowerLightModel.beam.pulseGain
  ) * sectionBoost * beamSectionScale;
  const beamDistance = clocktowerLightModel.beam.baseDistance + level * clocktowerLightModel.beam.levelDistanceGain;
  const beamAngle = 0.18 + level * 0.018 + (section === 1 ? 0.02 : section === 3 ? 0.012 : 0.0);
  const beamPenumbra = 0.36 + haze * 0.24;
  const beamNorm = clamp01(beamIntensity / (clocktowerLightModel.beam.baseIntensity + clocktowerLightModel.beam.pulseGain * 3.2));
  const beamConeOpacity = clamp01(0.035 + haze * (0.12 + beamNorm * 0.2));
  const beamSweep = Math.sin(t * 1.15) * (0.06 + beat * 0.04);

  const rimIntensity = (
    clocktowerLightModel.rim.baseIntensity
    + Math.sin(t * 2.3) * clocktowerLightModel.rim.swingIntensity
    + pulse * clocktowerLightModel.rim.pulseGain
  ) * sectionBoost;

  const strobePeakBase = section === 3
    ? clocktowerLightModel.strobe.sectionThreePeak
    : clocktowerLightModel.strobe.sectionDefaultPeak;
  const strobeDistance = 40 + level * 7 + (section === 3 ? 4 : 0);
  const strobeExponent = section === 3 ? 7.8 : section === 1 ? 6.5 : 5.6;
  const strobeStates = [];
  let strobePeakIntensity = 0;
  let activeStrobes = 0;
  let strobeEnergy = 0;

  for (let i = 0; i < strobeCount; i += 1) {
    const phase = t * (8.2 + i * 0.75 + (section === 3 ? 1.1 : 0.0)) + i * 1.13;
    const burst = smoothPulse(phase, strobeExponent);
    const sustain = section === 3
      ? (0.16 + beat * 0.12 + level * 0.08) * (0.58 + 0.42 * Math.sin(t * 0.55 + i * 1.6) ** 2)
      : 0;
    const gate = clamp01(Math.max(burst, sustain));
    const beatAmp = 0.92 + beat * 1.8;
    const intensity = clocktowerLightModel.strobe.baseIntensity + gate * strobePeakBase * beatAmp;
    const angle = 0.13 + (Math.sin(t * 0.7 + i) * 0.5 + 0.5) * (0.09 + level * 0.035);
    const coneOpacity = clamp01(0.004 + haze * (0.028 + Math.sqrt(clamp01(intensity / (strobePeakBase * 1.3))) * 0.06));
    const coneStretch = 1 + level * 0.1 + gate * 0.08;
    const target = {
      x: Math.sin(t * 0.48 + i * 1.4) * 1.8,
      y: 1.3 + Math.sin(t * 0.7 + i * 0.8) * 0.55,
      z: Math.cos(t * 0.52 + i * 1.1) * 1.5,
    };
    if (gate > 0.18) activeStrobes += 1;
    strobePeakIntensity = Math.max(strobePeakIntensity, intensity);
    strobeEnergy += intensity;
    strobeStates.push({
      intensity,
      angle,
      distance: strobeDistance,
      coneOpacity,
      coneStretch,
      target,
      gate,
    });
  }

  const strobeMean = strobeCount > 0 ? strobeEnergy / strobeCount : 0;
  const strobeNorm = clamp01(strobeMean / (strobePeakBase * 0.72 + clocktowerLightModel.strobe.baseIntensity));
  const exposure = 0.615 - strobeNorm * 0.14 - beamNorm * 0.08 + moonIntensity * 0.01;

  return {
    ambient: {
      intensity: clocktowerLightModel.ambient.intensity + moonIntensity * 0.06 + haze * 0.05,
      fogDensity: 0.058 + haze * 0.014,
    },
    key: {
      intensity: keyIntensity,
    },
    moon: {
      intensity: moonIntensity,
      haloPulse: 0.18 + level * 0.25 + beat * 0.38,
      reflectionPrimary: 1.2 + moonIntensity * clocktowerLightModel.moon.reflectionGainPrimary,
      reflectionWide: 0.82 + moonIntensity * clocktowerLightModel.moon.reflectionGainWide,
    },
    beam: {
      intensity: beamIntensity,
      distance: beamDistance,
      angle: beamAngle,
      penumbra: beamPenumbra,
      coneOpacity: beamConeOpacity,
      sweep: beamSweep,
      radius: beamDistance * Math.tan(beamAngle),
    },
    rim: {
      intensity: rimIntensity,
    },
    strobes: strobeStates,
    display: {
      exposure: Math.min(Math.max(exposure, 0.48), 0.67),
      bloomStrength: 0.34 + beamNorm * 0.1 + strobeNorm * 0.12 + beat * 0.05,
      bloomRadius: 0.18 + haze * 0.07 + strobeNorm * 0.03,
      bloomThreshold: 0.93 - strobeNorm * 0.03 - beamNorm * 0.015,
    },
    debug: {
      haze,
      keyIntensity,
      moonIntensity,
      beamIntensity,
      beamConeOpacity,
      beamAngle,
      strobePeakIntensity,
      strobeMeanIntensity: strobeMean,
      activeStrobes,
      exposure: Math.min(Math.max(exposure, 0.48), 0.67),
    },
  };
}

export function clocktowerLightingDebugState(state) {
  return {
    haze: Number(state.debug.haze.toFixed(4)),
    keyIntensity: Number(state.debug.keyIntensity.toFixed(3)),
    moonIntensity: Number(state.debug.moonIntensity.toFixed(3)),
    beamIntensity: Number(state.debug.beamIntensity.toFixed(3)),
    beamConeOpacity: Number(state.debug.beamConeOpacity.toFixed(4)),
    beamAngle: Number(state.debug.beamAngle.toFixed(4)),
    strobePeakIntensity: Number(state.debug.strobePeakIntensity.toFixed(3)),
    strobeMeanIntensity: Number(state.debug.strobeMeanIntensity.toFixed(3)),
    activeStrobes: state.debug.activeStrobes,
    exposure: Number(state.debug.exposure.toFixed(4)),
  };
}

export function computeClocktowerMoonState({
  moonPosition,
  cameraPosition,
  waterHeight,
}) {
  const moonDir = moonPosition.clone().normalize();
  const altitudeDeg = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(moonDir.y, -1, 1)));
  const airMass = airMassFromAltitudeDeg(altitudeDeg);
  const transmittance = new THREE.Color(
    Math.exp(-0.012 * airMass),
    Math.exp(-0.018 * airMass),
    Math.exp(-0.03 * airMass),
  );
  const rawColor = new THREE.Color(0xdcecff).multiply(transmittance);
  const peak = Math.max(rawColor.r, rawColor.g, rawColor.b, 1e-5);
  const discColor = rawColor.multiplyScalar(1 / peak);
  const transmittanceLuma = discColor.r * 0.2126 + discColor.g * 0.7152 + discColor.b * 0.0722;
  const visibleFactor = clamp01((altitudeDeg + 4.5) / 8.5);

  const incident = moonDir.clone().negate();
  const reflectionDir = incident.reflect(new THREE.Vector3(0, 1, 0)).normalize();
  let reflectionCenter = new THREE.Vector3(cameraPosition.x, waterHeight, cameraPosition.z - 18);
  if (reflectionDir.y > 1e-3) {
    const k = (cameraPosition.y - waterHeight) / reflectionDir.y;
    reflectionCenter = cameraPosition.clone().sub(reflectionDir.multiplyScalar(k));
    reflectionCenter.y = waterHeight;
  }
  const viewDir = cameraPosition.clone().sub(reflectionCenter).normalize();
  const fresnel = schlickFresnel(Math.abs(viewDir.y), 0.024);
  const lowAngle = clamp01(1 - THREE.MathUtils.clamp(moonDir.y, 0, 1));
  const reflectionStrength = visibleFactor * fresnel * (0.55 + lowAngle * 0.75);

  return {
    direction: moonDir,
    altitudeDeg,
    airMass,
    transmittanceLuma,
    discColor,
    discOpacity: THREE.MathUtils.lerp(0.68, 0.98, transmittanceLuma),
    discScale: THREE.MathUtils.lerp(0.92, 1.22, lowAngle),
    haloScale: THREE.MathUtils.lerp(0.92, 1.4, lowAngle),
    haloPulse: THREE.MathUtils.lerp(0.55, 1.18, visibleFactor) * (0.7 + lowAngle * 0.45),
    reflectionCenter,
    reflectionStrength,
    reflectionPrimaryScale: new THREE.Vector2(
      THREE.MathUtils.lerp(0.85, 1.5, lowAngle),
      THREE.MathUtils.lerp(0.9, 2.2, lowAngle),
    ),
    reflectionWideScale: new THREE.Vector2(
      THREE.MathUtils.lerp(1.45, 2.6, lowAngle),
      THREE.MathUtils.lerp(1.2, 2.9, lowAngle),
    ),
  };
}
