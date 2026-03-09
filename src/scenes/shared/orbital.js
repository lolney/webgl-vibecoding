import * as THREE from "three";

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function dirFromAzAlt(azimuth, altitude) {
  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(altitude),
    Math.sin(altitude),
    -Math.cos(azimuth) * Math.cos(altitude),
  ).normalize();
}

export function computeBinaryOrbitState({ t, binaryDayHours, planetOrbitRadius }) {
  const sysT = t * 0.24;
  const starAPosition = new THREE.Vector3(
    Math.cos(sysT) * 2.2,
    Math.sin(sysT * 0.35) * 0.35,
    Math.sin(sysT) * 2.2,
  );
  const starBPosition = new THREE.Vector3(
    -Math.cos(sysT * 1.03) * 2.9,
    Math.cos(sysT * 0.42) * 0.45,
    -Math.sin(sysT * 1.03) * 2.9,
  );

  const planetOrbitA = sysT * 0.38;
  const planetPosition = new THREE.Vector3(
    Math.cos(planetOrbitA) * planetOrbitRadius,
    0,
    Math.sin(planetOrbitA) * planetOrbitRadius,
  );

  const dayPhase = binaryDayHours / 24;
  const primaryAltitude = Math.sin((dayPhase - 0.25) * Math.PI * 2);
  const secondSunStart = 18.48;
  const secondSunEnd = 18.78;
  const secondWindow = smoothstep(secondSunStart, secondSunStart + 0.02, binaryDayHours)
    * (1 - smoothstep(secondSunEnd - 0.02, secondSunEnd, binaryDayHours));
  const secondArc = THREE.MathUtils.clamp(
    (binaryDayHours - secondSunStart) / Math.max(0.0001, secondSunEnd - secondSunStart),
    0,
    1,
  );
  const secondaryAltitude = Math.sin(secondArc * Math.PI) * secondWindow;

  const dayStrength = THREE.MathUtils.clamp(primaryAltitude * 1.15, 0, 1);
  const secondStrength = THREE.MathUtils.clamp(secondaryAltitude * 2.6, 0, 1);
  const daylight = smoothstep(-0.12, 0.25, primaryAltitude);
  const twilight = smoothstep(-0.24, -0.02, primaryAltitude) * (1 - smoothstep(0.15, 0.5, primaryAltitude));

  const primaryAz = Math.sin((binaryDayHours - 12) * 0.18) * 0.4;
  const primaryAlt = primaryAltitude * (Math.PI * 0.32) + 0.16;
  const secondaryAz = -0.32;
  const secondaryAlt = (-0.01 + secondaryAltitude * 0.06) * Math.PI + 0.11;

  const primaryDir = dirFromAzAlt(primaryAz, primaryAlt);
  const secondaryDir = dirFromAzAlt(secondaryAz, secondaryAlt);

  return {
    sysT,
    starAPosition,
    starBPosition,
    planetPosition,
    dayPhase,
    dayStrength,
    secondStrength,
    daylight,
    twilight,
    primaryDir,
    secondaryDir,
    secondWindow,
  };
}
