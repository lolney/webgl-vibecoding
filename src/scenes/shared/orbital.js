import * as THREE from "three";

const TAU = Math.PI * 2;
const BINARY_ORBIT_PERIOD_DAYS = 32;
const PLANET_YEAR_DAYS = 220;
const AXIAL_TILT = THREE.MathUtils.degToRad(18);
const STAR_A_LUMINOSITY = 1.0;
const STAR_B_LUMINOSITY = 0.42;

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

function buildLocalFrame(observerNormal, spinAxis) {
  const east = new THREE.Vector3().crossVectors(spinAxis, observerNormal);
  if (east.lengthSq() < 1e-8) {
    east.set(1, 0, 0);
  } else {
    east.normalize();
  }
  const north = new THREE.Vector3().crossVectors(observerNormal, east).normalize();
  return { east, north };
}

export function computeBinarySimulationState({
  binaryDayHours,
  simulationDays = null,
  planetOrbitRadius,
  cameraPosition,
  cameraTarget,
  observerLatitude = 0,
  observerLongitude = 0,
}) {
  const dayPhase = THREE.MathUtils.euclideanModulo(binaryDayHours, 24) / 24;
  const localHourAngle = (dayPhase - 0.5) * TAU + observerLongitude;
  const simDays = Number.isFinite(simulationDays) ? simulationDays : (binaryDayHours / 24);

  // One continuous model drives all motion: slow orbital progression, fast planetary spin.
  const binaryAngle = simDays * (TAU / BINARY_ORBIT_PERIOD_DAYS) + 0.52;
  const planetAngle = simDays * (TAU / PLANET_YEAR_DAYS) + 0.7;

  const starAPosition = new THREE.Vector3(
    Math.cos(binaryAngle) * 4.1,
    Math.sin(binaryAngle) * 0.22,
    Math.sin(binaryAngle) * 4.1,
  );
  const starBPosition = new THREE.Vector3(
    -Math.cos(binaryAngle) * 4.9,
    -Math.sin(binaryAngle * 1.07) * 0.18,
    -Math.sin(binaryAngle) * 4.9,
  );
  const planetPosition = new THREE.Vector3(
    Math.cos(planetAngle) * planetOrbitRadius,
    0,
    Math.sin(planetAngle) * planetOrbitRadius,
  );

  const spinAxis = new THREE.Vector3(0, Math.cos(AXIAL_TILT), Math.sin(AXIAL_TILT)).normalize();
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

  const observerNormal = noonMeridian
    .clone()
    .multiplyScalar(cosLat * Math.cos(localHourAngle))
    .add(eastReference.clone().multiplyScalar(cosLat * Math.sin(localHourAngle)))
    .add(spinAxis.clone().multiplyScalar(Math.sin(observerLatitude)))
    .normalize();
  const spinDir = new THREE.Vector2(observerNormal.x, observerNormal.z).normalize();

  // Viewer turning changes heading only; it does not move observer location.
  const lookWorld = new THREE.Vector3().copy(cameraTarget).sub(cameraPosition);
  if (lookWorld.lengthSq() < 1e-8) lookWorld.set(0, 0, -1);
  lookWorld.normalize();
  const viewerTangentWorld = projectToTangent(lookWorld, observerNormal);
  const { east, north } = buildLocalFrame(observerNormal, spinAxis);
  const lookHorizontal = new THREE.Vector2(viewerTangentWorld.x, viewerTangentWorld.z);
  if (lookHorizontal.lengthSq() < 1e-8) {
    lookHorizontal.set(noonMeridian.x, noonMeridian.z);
  }
  lookHorizontal.normalize();

  // Weight by inverse-square falloff and star "intrinsic" brightness.
  const weightA = STAR_A_LUMINOSITY / (distA * distA);
  const weightB = STAR_B_LUMINOSITY / (distB * distB);
  const combinedStarWorld = toA.clone().multiplyScalar(weightA).add(toB.clone().multiplyScalar(weightB)).normalize();
  const combinedStarTangent = projectToTangent(combinedStarWorld, observerNormal);
  const combinedStarDir = new THREE.Vector2(combinedStarTangent.x, combinedStarTangent.z);
  if (combinedStarDir.lengthSq() > 1e-8) combinedStarDir.normalize();

  const altitudeA = Math.asin(THREE.MathUtils.clamp(toA.dot(observerNormal), -1, 1));
  const altitudeB = Math.asin(THREE.MathUtils.clamp(toB.dot(observerNormal), -1, 1));
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

  // Heading is defined in the observer's local tangent frame.
  const viewerDir = lookHorizontal.clone();
  const viewerEast = viewerTangentWorld.dot(east);
  const viewerNorth = viewerTangentWorld.dot(north);
  const resolvedTurnYaw = Math.atan2(viewerEast, viewerNorth);
  const observerYaw = Math.atan2(observerNormal.x, -observerNormal.z);
  const viewerYaw = observerYaw + resolvedTurnYaw;
  const primaryAzimuth = Math.atan2(toA.dot(east), toA.dot(north));
  const secondaryAzimuth = Math.atan2(toB.dot(east), toB.dot(north));

  return {
    dayPhase,
    spinYaw: localHourAngle,
    viewerTurnYaw: resolvedTurnYaw,
    observerYaw,
    viewerYaw,
    observerLatitude,
    observerLongitude,
    observerNormal,
    viewerTangentWorld,
    spinAxis,
    localHourAngle,
    starAPosition,
    starBPosition,
    planetPosition,
    spinDir,
    viewerDir,
    combinedStarDir,
    viewerLightDot,
    dayStrength,
    secondStrength,
    daylight,
    twilight,
    primaryDir,
    secondaryDir,
    primaryAltitude: altitudeA,
    secondaryAltitude: altitudeB,
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
