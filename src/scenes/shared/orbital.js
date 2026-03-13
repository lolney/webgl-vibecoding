import * as THREE from "three";
import { defaultBinarySystemKey, getBinarySystemConfig } from "./binarySystems.js";

const TAU = Math.PI * 2;
export const PLANET_YEAR_DAYS = getBinarySystemConfig(defaultBinarySystemKey).planetYearDays;

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function extractViewerTurnYaw(cameraPosition, cameraTarget) {
  const look = new THREE.Vector3().copy(cameraTarget).sub(cameraPosition).setY(0);
  if (look.lengthSq() < 1e-8) return 0;
  look.normalize();
  return Math.atan2(look.x, -look.z);
}

function projectToTangent(worldDir, surfaceNormal) {
  const tangent = worldDir.clone().sub(surfaceNormal.clone().multiplyScalar(worldDir.dot(surfaceNormal)));
  if (tangent.lengthSq() < 1e-8) return tangent.set(0, 0, 0);
  return tangent.normalize();
}

function projectOnPlane(worldDir, planeNormal) {
  return worldDir.clone().sub(planeNormal.clone().multiplyScalar(worldDir.dot(planeNormal)));
}

function toXZUnit(vec3, fallback = null) {
  const v = new THREE.Vector2(vec3.x, vec3.z);
  if (v.lengthSq() < 1e-8) {
    return fallback ? fallback.clone() : new THREE.Vector2(0, -1);
  }
  return v.normalize();
}

function buildContinuousLocalFrame(observerNormal, travelNorth) {
  const north = projectToTangent(travelNorth, observerNormal);
  if (north.lengthSq() < 1e-8) {
    north.set(0, 0, 1);
  } else {
    north.normalize();
  }
  const east = new THREE.Vector3().crossVectors(north, observerNormal);
  if (east.lengthSq() < 1e-8) {
    east.set(1, 0, 0);
  } else {
    east.normalize();
  }
  return { east, north };
}

function declinationFromDirection(direction, spinAxis) {
  return Math.asin(THREE.MathUtils.clamp(direction.dot(spinAxis), -1, 1));
}

function phaseFractionFromDirections(lightDir, viewDir) {
  return THREE.MathUtils.clamp((1 + lightDir.dot(viewDir)) * 0.5, 0, 1);
}

function apparentDisc(position, cameraPosition, radius) {
  const toBody = position.clone().sub(cameraPosition);
  const distance = Math.max(1e-6, toBody.length());
  return {
    dir: toBody.normalize(),
    distance,
    angularRadius: Math.asin(Math.min(0.999, radius / distance)),
  };
}

function overlapFraction(foregroundRadius, backgroundRadius, separation) {
  if (separation >= foregroundRadius + backgroundRadius) return 0;
  if (separation <= Math.abs(foregroundRadius - backgroundRadius)) {
    return THREE.MathUtils.clamp(
      (Math.min(foregroundRadius, backgroundRadius) ** 2) / (backgroundRadius ** 2),
      0,
      1,
    );
  }
  const a1 = Math.acos(THREE.MathUtils.clamp(
    (separation * separation + foregroundRadius * foregroundRadius - backgroundRadius * backgroundRadius)
      / (2 * separation * foregroundRadius),
    -1,
    1,
  ));
  const a2 = Math.acos(THREE.MathUtils.clamp(
    (separation * separation + backgroundRadius * backgroundRadius - foregroundRadius * foregroundRadius)
      / (2 * separation * backgroundRadius),
    -1,
    1,
  ));
  const area = foregroundRadius * foregroundRadius * a1
    + backgroundRadius * backgroundRadius * a2
    - 0.5 * Math.sqrt(Math.max(
      0,
      (-separation + foregroundRadius + backgroundRadius)
        * (separation + foregroundRadius - backgroundRadius)
        * (separation - foregroundRadius + backgroundRadius)
        * (separation + foregroundRadius + backgroundRadius),
    ));
  return THREE.MathUtils.clamp(area / (Math.PI * backgroundRadius * backgroundRadius), 0, 1);
}

function occlusionFraction(foregroundDisc, backgroundDisc) {
  if (foregroundDisc.distance >= backgroundDisc.distance) return 0;
  const separation = Math.acos(THREE.MathUtils.clamp(
    foregroundDisc.dir.dot(backgroundDisc.dir),
    -1,
    1,
  ));
  return overlapFraction(foregroundDisc.angularRadius, backgroundDisc.angularRadius, separation);
}

export function computeBinarySimulationState({
  binaryDayHours,
  simulationDays = null,
  planetOrbitRadius,
  systemKey = defaultBinarySystemKey,
  cameraPosition,
  cameraTarget,
  observerLatitude = 0,
  observerLongitude = 0,
  viewerForwardWorld = null,
  viewerHeadingYaw = null,
  viewerPitch = 0,
}) {
  const system = getBinarySystemConfig(systemKey);
  const {
    binaryOrbitPeriodDays,
    planetYearDays,
    axialTiltRad,
    starA,
    starB,
    binaryAngleOffset,
    planetAngleOffset,
    resonanceCycles,
  } = system;
  const starARadius = starA.radius;
  const starBRadius = starB.radius;
  const planetRadius = 0.65;
  const dayPhase = THREE.MathUtils.euclideanModulo(binaryDayHours, 24) / 24;
  const localHourAngle = (dayPhase - 0.5) * TAU + observerLongitude;
  const simDays = Number.isFinite(simulationDays) ? simulationDays : (binaryDayHours / 24);
  const seasonDay = THREE.MathUtils.euclideanModulo(simDays, planetYearDays);
  const seasonPhase = seasonDay / planetYearDays;

  // One continuous model drives all motion: slow orbital progression, fast planetary spin.
  const binaryAngle = simDays * (TAU / binaryOrbitPeriodDays) + binaryAngleOffset;
  const planetAngle = simDays * (TAU / planetYearDays) + planetAngleOffset;
  const resonancePhase = THREE.MathUtils.euclideanModulo(
    (binaryAngle * resonanceCycles.planet) - (planetAngle * resonanceCycles.binary),
    TAU,
  );
  const resonanceStrength = 0.5 + 0.5 * Math.cos(resonancePhase);
  const resonanceWindow = smoothstep(0.74, 0.98, resonanceStrength);

  const starAPosition = new THREE.Vector3(
    Math.cos(binaryAngle + starA.phaseOffset) * starA.orbitRadius,
    Math.sin(binaryAngle * starA.verticalFrequency + starA.verticalPhase) * starA.verticalAmplitude,
    Math.sin(binaryAngle + starA.phaseOffset) * starA.orbitRadius,
  );
  const starBPosition = new THREE.Vector3(
    Math.cos(binaryAngle + starB.phaseOffset) * starB.orbitRadius,
    Math.sin(binaryAngle * starB.verticalFrequency + starB.verticalPhase) * starB.verticalAmplitude,
    Math.sin(binaryAngle + starB.phaseOffset) * starB.orbitRadius,
  );
  const planetPosition = new THREE.Vector3(
    Math.cos(planetAngle) * planetOrbitRadius,
    0,
    Math.sin(planetAngle) * planetOrbitRadius,
  );

  const spinAxis = new THREE.Vector3(0, Math.cos(axialTiltRad), Math.sin(axialTiltRad)).normalize();
  const cosLat = Math.cos(observerLatitude);
  const toA = new THREE.Vector3().subVectors(starAPosition, planetPosition).normalize();
  const toB = new THREE.Vector3().subVectors(starBPosition, planetPosition).normalize();
  const distA = Math.max(0.001, starAPosition.distanceTo(planetPosition));
  const distB = Math.max(0.001, starBPosition.distanceTo(planetPosition));

  // Define the local noon meridian from the primary star projected onto the equatorial plane.
  const noonMeridian = projectOnPlane(toA, spinAxis);
  if (noonMeridian.lengthSq() < 1e-8) noonMeridian.set(1, 0, 0);
  noonMeridian.normalize();
  const eastReference = new THREE.Vector3().crossVectors(spinAxis, noonMeridian).normalize();

  const equatorReference = noonMeridian
    .clone()
    .multiplyScalar(Math.cos(localHourAngle))
    .add(eastReference.clone().multiplyScalar(Math.sin(localHourAngle)))
    .normalize();
  const observerNormal = equatorReference
    .clone()
    .multiplyScalar(cosLat)
    .add(spinAxis.clone().multiplyScalar(Math.sin(observerLatitude)))
    .normalize();
  const travelNorth = equatorReference
    .clone()
    .multiplyScalar(-Math.sin(observerLatitude))
    .add(spinAxis.clone().multiplyScalar(cosLat))
    .normalize();
  const spinDir = new THREE.Vector2(observerNormal.x, observerNormal.z).normalize();

  // Viewer turning changes heading only; it does not move observer location.
  const { east, north } = buildContinuousLocalFrame(observerNormal, travelNorth);
  const lookWorld = viewerForwardWorld instanceof THREE.Vector3
    ? viewerForwardWorld.clone().normalize()
    : Number.isFinite(viewerHeadingYaw)
    ? east.clone()
      .multiplyScalar(Math.sin(viewerHeadingYaw) * Math.cos(viewerPitch))
      .add(north.clone().multiplyScalar(Math.cos(viewerHeadingYaw) * Math.cos(viewerPitch)))
      .add(observerNormal.clone().multiplyScalar(Math.sin(viewerPitch)))
      .normalize()
    : new THREE.Vector3().copy(cameraTarget).sub(cameraPosition).normalize();
  if (lookWorld.lengthSq() < 1e-8) lookWorld.set(0, 0, -1);
  const lookLocal = new THREE.Vector3(
    lookWorld.dot(east),
    lookWorld.dot(observerNormal),
    lookWorld.dot(north),
  ).normalize();
  const viewerTangentWorld = projectToTangent(lookWorld, observerNormal);
  const viewerEast = viewerTangentWorld.dot(east);
  const viewerNorth = viewerTangentWorld.dot(north);
  const viewerDirLocal = new THREE.Vector2(viewerEast, viewerNorth);
  if (viewerDirLocal.lengthSq() < 1e-8) {
    viewerDirLocal.set(0, 1);
  }
  viewerDirLocal.normalize();

  // Weight by inverse-square falloff and star "intrinsic" brightness.
  const weightA = starA.luminosity / (distA * distA);
  const weightB = starB.luminosity / (distB * distB);
  const cameraFromPlanet = cameraPosition instanceof THREE.Vector3
    ? cameraPosition.clone().sub(planetPosition)
    : new THREE.Vector3(0, 0, 1);
  if (cameraFromPlanet.lengthSq() < 1e-8) cameraFromPlanet.set(0, 0, 1);
  cameraFromPlanet.normalize();
  const phaseFractionA = phaseFractionFromDirections(toA, cameraFromPlanet);
  const phaseFractionB = phaseFractionFromDirections(toB, cameraFromPlanet);
  const apparentPlanet = apparentDisc(planetPosition, cameraPosition, planetRadius);
  const apparentStarA = apparentDisc(starAPosition, cameraPosition, starARadius);
  const apparentStarB = apparentDisc(starBPosition, cameraPosition, starBRadius);
  const primaryTransitFraction = occlusionFraction(apparentPlanet, apparentStarA);
  const secondaryTransitFraction = occlusionFraction(apparentPlanet, apparentStarB);
  const primaryStarEclipseFraction = occlusionFraction(apparentStarB, apparentStarA);
  const secondaryStarEclipseFraction = occlusionFraction(apparentStarA, apparentStarB);
  const primaryOcclusionFraction = THREE.MathUtils.clamp(primaryTransitFraction + primaryStarEclipseFraction, 0, 1);
  const secondaryOcclusionFraction = THREE.MathUtils.clamp(secondaryTransitFraction + secondaryStarEclipseFraction, 0, 1);
  const combinedPhaseFraction = THREE.MathUtils.clamp(
    ((phaseFractionA * weightA) + (phaseFractionB * weightB)) / Math.max(1e-6, weightA + weightB),
    0,
    1,
  );
  const combinedStarWorld = toA.clone().multiplyScalar(weightA).add(toB.clone().multiplyScalar(weightB)).normalize();
  const combinedStarTangent = projectToTangent(combinedStarWorld, observerNormal);
  const combinedStarDirWorld = toXZUnit(combinedStarWorld);
  const combinedStarDirLocal = new THREE.Vector2(combinedStarTangent.dot(east), combinedStarTangent.dot(north));
  if (combinedStarDirLocal.lengthSq() > 1e-8) combinedStarDirLocal.normalize();

  const altitudeA = Math.asin(THREE.MathUtils.clamp(toA.dot(observerNormal), -1, 1));
  const altitudeB = Math.asin(THREE.MathUtils.clamp(toB.dot(observerNormal), -1, 1));
  const primaryDeclination = declinationFromDirection(toA, spinAxis);
  const secondaryDeclination = declinationFromDirection(toB, spinAxis);
  const incidenceA = Math.max(0, Math.sin(altitudeA));
  const incidenceB = Math.max(0, Math.sin(altitudeB));
  const lightA = incidenceA * weightA;
  const lightB = incidenceB * weightB;
  const lightTotal = lightA + lightB;

  const daylight = THREE.MathUtils.clamp(lightTotal * 260, 0, 1);
  const dayStrength = THREE.MathUtils.clamp(lightA * 300, 0, 1);
  const secondStrength = THREE.MathUtils.clamp(lightB * 520, 0, 1);

  const maxIncidence = Math.max(Math.sin(altitudeA), Math.sin(altitudeB));
  const twilight = smoothstep(-0.16, 0.07, maxIncidence) * (1 - smoothstep(0.17, 0.42, maxIncidence));

  const primaryDir = toA;
  const secondaryDir = toB;
  const viewerLightDot = observerNormal.dot(combinedStarWorld);
  const primaryLocalDir = new THREE.Vector3(
    toA.dot(east),
    toA.dot(observerNormal),
    toA.dot(north),
  ).normalize();
  const secondaryLocalDir = new THREE.Vector3(
    toB.dot(east),
    toB.dot(observerNormal),
    toB.dot(north),
  ).normalize();

  // Heading is defined in the observer's local tangent frame.
  const resolvedTurnYaw = Number.isFinite(viewerHeadingYaw) ? viewerHeadingYaw : Math.atan2(viewerEast, viewerNorth);
  const observerYaw = Math.atan2(observerNormal.x, -observerNormal.z);
  const viewerYaw = observerYaw + resolvedTurnYaw;
  const primaryAzimuth = Math.atan2(toA.dot(east), toA.dot(north));
  const secondaryAzimuth = Math.atan2(toB.dot(east), toB.dot(north));
  const siteDirWorld = toXZUnit(observerNormal, noonMeridian ? new THREE.Vector2(noonMeridian.x, noonMeridian.z).normalize() : null);
  const viewerDirWorld = toXZUnit(viewerTangentWorld, siteDirWorld);

  return {
    dayPhase,
    seasonDay,
    seasonPhase,
    systemKey: system.key,
    resonanceLabel: `${resonanceCycles.binary}:${resonanceCycles.planet}`,
    resonancePhase,
    resonanceStrength,
    resonanceWindow,
    spinYaw: localHourAngle,
    viewerTurnYaw: resolvedTurnYaw,
    observerYaw,
    viewerYaw,
    lookWorld,
    lookLocal,
    observerLatitude,
    observerLongitude,
    observerNormal,
    travelNorth,
    viewerTangentWorld,
    east,
    north,
    spinAxis,
    localHourAngle,
    starAPosition,
    starBPosition,
    planetPosition,
    spinDir,
    viewerDir: viewerDirWorld,
    viewerDirLocal,
    combinedStarDir: combinedStarDirWorld,
    combinedStarDirLocal,
    viewerLightDot,
    dayStrength,
    secondStrength,
    daylight,
    twilight,
    primaryDir,
    secondaryDir,
    combinedStarWorld,
    cameraFromPlanet,
    phaseFractionA,
    phaseFractionB,
    combinedPhaseFraction,
    primaryTransitFraction,
    secondaryTransitFraction,
    primaryStarEclipseFraction,
    secondaryStarEclipseFraction,
    primaryOcclusionFraction,
    secondaryOcclusionFraction,
    primaryLocalDir,
    secondaryLocalDir,
    siteDirWorld,
    primaryAltitude: altitudeA,
    secondaryAltitude: altitudeB,
    primaryDeclination,
    secondaryDeclination,
    primaryAzimuth,
    secondaryAzimuth,
    orbitRadius: planetOrbitRadius,
  };
}

// Backward compatibility for current scene code while migrating.
export function computeBinaryOrbitState({ binaryDayHours, planetOrbitRadius, cameraPosition, cameraTarget }) {
  return computeBinarySimulationState({ binaryDayHours, planetOrbitRadius, cameraPosition, cameraTarget });
}

export function computeBinaryViewerState({
  planetPosition,
  planetRotationY,
  cameraPosition,
  cameraTarget,
  orbitRadius,
  starAPosition,
  starBPosition,
}) {
  const surfaceNormal = new THREE.Vector3(Math.sin(planetRotationY), 0, -Math.cos(planetRotationY)).normalize();
  const viewerTurnYaw = extractViewerTurnYaw(cameraPosition, cameraTarget);
  const viewerYaw = planetRotationY + viewerTurnYaw;
  const viewerNormal = new THREE.Vector3(Math.sin(viewerYaw), 0, -Math.cos(viewerYaw)).normalize();

  const spinDir = new THREE.Vector2(surfaceNormal.x, surfaceNormal.z);
  const viewerDir = new THREE.Vector2(viewerNormal.x, viewerNormal.z);

  const lightA = new THREE.Vector2(starAPosition.x - planetPosition.x, starAPosition.z - planetPosition.z).normalize();
  const lightB = new THREE.Vector2(starBPosition.x - planetPosition.x, starBPosition.z - planetPosition.z).normalize();
  const combinedStarDir = lightA.clone().multiplyScalar(0.64).add(lightB.clone().multiplyScalar(0.36)).normalize();

  return {
    starA: new THREE.Vector2(starAPosition.x, starAPosition.z),
    starB: new THREE.Vector2(starBPosition.x, starBPosition.z),
    planet: new THREE.Vector2(planetPosition.x, planetPosition.z),
    spinDir,
    viewerDir,
    combinedStarDir,
    viewerLightDot: viewerDir.dot(combinedStarDir),
    viewerTurnYaw,
    spinYaw: planetRotationY,
    viewerYaw,
    orbitRadius,
  };
}
