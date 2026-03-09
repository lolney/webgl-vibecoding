import * as THREE from "three";

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

function buildLocalFrame(surfaceNormal) {
  const worldUp = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(worldUp, surfaceNormal);
  if (east.lengthSq() < 1e-8) east.set(1, 0, 0);
  east.normalize();
  const north = new THREE.Vector3().crossVectors(surfaceNormal, east).normalize();
  return { east, north };
}

function toViewerLocal(worldDir, frame, surfaceNormal) {
  return new THREE.Vector3(
    worldDir.dot(frame.east),
    worldDir.dot(surfaceNormal),
    worldDir.dot(frame.north),
  ).normalize();
}

export function computeBinarySimulationState({
  binaryDayHours,
  planetOrbitRadius,
  cameraPosition,
  cameraTarget,
  observerLatitude = 0,
  observerLongitude = 0,
}) {
  const dayPhase = THREE.MathUtils.euclideanModulo(binaryDayHours, 24) / 24;
  const dayAngle = dayPhase * Math.PI * 2;

  // One shared simulation clock drives all orbital motion.
  const starOrbitAngle = dayAngle * 2.15;
  const planetOrbitAngle = dayAngle * 0.22 + 0.7;

  const starAPosition = new THREE.Vector3(
    Math.cos(starOrbitAngle) * 4.6,
    Math.sin(starOrbitAngle * 0.67) * 0.32,
    Math.sin(starOrbitAngle) * 4.6,
  );
  const starBPosition = new THREE.Vector3(
    -Math.cos(starOrbitAngle) * 5.4,
    Math.cos(starOrbitAngle * 0.91) * 0.28,
    -Math.sin(starOrbitAngle) * 5.4,
  );
  const planetPosition = new THREE.Vector3(
    Math.cos(planetOrbitAngle) * planetOrbitRadius,
    0,
    Math.sin(planetOrbitAngle) * planetOrbitRadius,
  );

  const spinYaw = dayAngle; // Exactly one rotation per day.
  const viewerTurnYaw = extractViewerTurnYaw(cameraPosition, cameraTarget);
  const observerYaw = spinYaw + observerLongitude;
  const cosLat = Math.cos(observerLatitude);
  const observerNormal = new THREE.Vector3(
    Math.sin(observerYaw) * cosLat,
    Math.sin(observerLatitude),
    -Math.cos(observerYaw) * cosLat,
  ).normalize();
  const spinDir = new THREE.Vector2(observerNormal.x, observerNormal.z).normalize();

  // Viewer turning changes heading only; it does not move observer location.
  const viewerYaw = observerYaw + viewerTurnYaw;
  const viewerDir = new THREE.Vector2(Math.sin(viewerYaw), -Math.cos(viewerYaw)).normalize();

  const toA = new THREE.Vector3().subVectors(starAPosition, planetPosition).normalize();
  const toB = new THREE.Vector3().subVectors(starBPosition, planetPosition).normalize();
  const distA = Math.max(0.001, starAPosition.distanceTo(planetPosition));
  const distB = Math.max(0.001, starBPosition.distanceTo(planetPosition));

  // Weight by inverse-square falloff and star "intrinsic" brightness.
  const weightA = 1.0 / (distA * distA);
  const weightB = 0.68 / (distB * distB);
  const combinedStarWorld = toA.clone().multiplyScalar(weightA).add(toB.clone().multiplyScalar(weightB)).normalize();
  const combinedStarDir = new THREE.Vector2(combinedStarWorld.x, combinedStarWorld.z);

  const incidenceA = Math.max(0, toA.dot(observerNormal));
  const incidenceB = Math.max(0, toB.dot(observerNormal));
  const lightA = incidenceA * weightA;
  const lightB = incidenceB * weightB;
  const lightTotal = lightA + lightB;

  const daylight = THREE.MathUtils.clamp(lightTotal * 500, 0, 1);
  const dayStrength = THREE.MathUtils.clamp(lightA * 620, 0, 1);
  const secondStrength = THREE.MathUtils.clamp(lightB * 780, 0, 1);

  const maxIncidence = Math.max(toA.dot(observerNormal), toB.dot(observerNormal));
  const twilight = smoothstep(-0.16, 0.07, maxIncidence) * (1 - smoothstep(0.17, 0.42, maxIncidence));

  const primaryDir = toA;
  const secondaryDir = toB;
  const viewerLightDot = observerNormal.dot(combinedStarWorld);

  return {
    dayPhase,
    spinYaw,
    viewerTurnYaw,
    observerYaw,
    viewerYaw,
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
