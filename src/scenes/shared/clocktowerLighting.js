import { clocktowerLightModel } from "./lightModel.js";

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
}

function smoothPulse(phase, exponent) {
  return Math.pow(Math.max(0, Math.sin(phase)), exponent);
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

  const beamIntensity = (
    clocktowerLightModel.beam.baseIntensity
    + pulse * clocktowerLightModel.beam.pulseGain
  ) * sectionBoost;
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
  const exposure = 0.62 - strobeNorm * 0.09 - beamNorm * 0.045 + moonIntensity * 0.012;

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
      bloomStrength: 0.44 + beamNorm * 0.18 + strobeNorm * 0.24 + beat * 0.08,
      bloomRadius: 0.22 + haze * 0.1 + strobeNorm * 0.05,
      bloomThreshold: 0.9 - strobeNorm * 0.05 - beamNorm * 0.02,
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
