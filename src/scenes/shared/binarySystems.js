import * as THREE from "three";

export const defaultBinarySystemKey = "standardBinary";

export const binarySystemConfigs = {
  standardBinary: {
    key: "standardBinary",
    label: "Standard Binary",
    binaryOrbitPeriodDays: 32,
    planetYearDays: 220,
    axialTiltRad: THREE.MathUtils.degToRad(18),
    starA: {
      radius: 1.3,
      luminosity: 1.0,
      orbitRadius: 4.1,
      verticalAmplitude: 0.22,
      verticalFrequency: 1.0,
      verticalPhase: 0.0,
      phaseOffset: 0.0,
    },
    starB: {
      radius: 1.05,
      luminosity: 0.42,
      orbitRadius: 4.9,
      verticalAmplitude: 0.18,
      verticalFrequency: 1.07,
      verticalPhase: 0.0,
      phaseOffset: Math.PI,
    },
    binaryAngleOffset: 0.52,
    planetAngleOffset: 0.7,
    resonanceCycles: { binary: 13, planet: 2 },
  },
  twilightRelayBinary: {
    key: "twilightRelayBinary",
    label: "Twilight Relay Binary",
    binaryOrbitPeriodDays: 0.1371234532171692,
    planetYearDays: 220,
    axialTiltRad: 0.1804539619818235,
    starA: {
      radius: 0.28,
      luminosity: 0.92,
      orbitRadius: 4.093209271964608,
      verticalAmplitude: 0.07971684934088819,
      verticalFrequency: 1.0,
      verticalPhase: 0.0,
      phaseOffset: 0.0,
    },
    starB: {
      radius: 0.32,
      luminosity: 0.55,
      orbitRadius: 4.9564868641699,
      verticalAmplitude: 0.25636704019781564,
      verticalFrequency: 1.0,
      verticalPhase: 4.395606659837259,
      phaseOffset: 3.8069122864168192,
    },
    binaryAngleOffset: 2.2581068208425323,
    planetAngleOffset: 2.1601473376693523,
    resonanceCycles: { binary: 8, planet: 1 },
  },
};

export function getBinarySystemConfig(systemKey = defaultBinarySystemKey) {
  return binarySystemConfigs[systemKey] || binarySystemConfigs[defaultBinarySystemKey];
}
