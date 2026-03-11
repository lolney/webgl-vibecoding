export const binaryLightModel = {
  primaryStar: {
    topOfAtmosphereLux: 128000,
    visibleDiscLuminance: 26,
    haloLuminance: 5.2,
    localLightIntensityScale: 0.00105,
    localLightBias: 10,
    atmosphereScatterScale: 1.0,
  },
  secondaryStar: {
    topOfAtmosphereLux: 46000,
    visibleDiscLuminance: 14,
    haloLuminance: 2.8,
    localLightIntensityScale: 0.00125,
    localLightBias: 2.5,
    atmosphereScatterScale: 0.68,
  },
  ambientBounce: {
    nightLux: 0.05,
    dayLux: 0.31,
    secondaryBounceScale: 0.2,
  },
  fillBounce: {
    baseLux: 0.08,
    primaryScale: 0.38,
    secondaryScale: 0.24,
  },
  atmosphere: {
    baseIntensity: 0.24,
    daylightGain: 0.18,
    twilightGain: 0.08,
  },
};

export const clocktowerLightModel = {
  ambient: {
    intensity: 0.56,
    color: 0x3346bb,
  },
  key: {
    baseIntensity: 1.0,
    swingIntensity: 0.3,
    levelGain: 0.4,
    sectionTwoBoost: 0.35,
  },
  moon: {
    baseIntensity: 0.7,
    swingIntensity: 0.15,
    levelGain: 0.25,
    reflectionGainPrimary: 0.42,
    reflectionGainWide: 0.28,
  },
  rim: {
    baseIntensity: 360,
    swingIntensity: 110,
    pulseGain: 320,
  },
  beam: {
    baseIntensity: 520,
    pulseGain: 980,
    baseDistance: 62,
    levelDistanceGain: 6,
  },
  strobe: {
    baseIntensity: 60,
    sectionDefaultPeak: 2800,
    sectionThreePeak: 4400,
  },
  sectionBoost: {
    sectionOne: 1.22,
    sectionThree: 1.34,
    default: 1.0,
  },
};
