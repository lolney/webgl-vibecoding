import * as THREE from "three";
import { computeBinarySimulationState } from "../shared/orbital.js";

export function updateBinaryScene(ctx, frame) {
  const {
    camera,
    controls,
    renderer,
    scene,
    composer,
    stars,
    sky,
    ambient,
    binaryFill,
    binaryStarALight,
    binaryStarBLight,
    planetAtmosphere,
    starAGroup,
    starBGroup,
    planetPivot,
    planetGroup,
    cloudLayer,
    surfaceGround,
    surfaceSky,
    surfaceOcean,
    surfaceSunA,
    surfaceSunB,
    surfaceReflectionA,
    surfaceReflectionB,
    bloomPass,
    crtPass,
    timeIndicator,
    format24Hour,
    planetOrbitRadius,
  } = ctx;

  const {
    t,
    beat,
    level,
    cinematicMix,
    activeSceneKey,
    binaryDayHours,
    binarySimulationDays,
    observerLatitudeDeg,
    observerLongitudeDeg,
    debugView,
  } = frame;

  const orbit = computeBinarySimulationState({
    binaryDayHours,
    simulationDays: binarySimulationDays,
    planetOrbitRadius,
    cameraPosition: camera.position,
    cameraTarget: controls.target,
    observerLatitude: THREE.MathUtils.degToRad(observerLatitudeDeg || 0),
    observerLongitude: THREE.MathUtils.degToRad(observerLongitudeDeg || 0),
  });
  const {
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
  } = orbit;

  const nightness = 1 - daylight;
  const isSurfaceScene = activeSceneKey === "binarySurface";
  const isExternalScene = activeSceneKey === "binaryExternal";

  starAGroup.position.copy(starAPosition);
  starBGroup.position.copy(starBPosition);
  binaryStarALight.position.copy(starAGroup.position);
  binaryStarBLight.position.copy(starBGroup.position);

  planetPivot.position.copy(planetPosition);
  planetGroup.rotation.y = orbit.spinYaw;
  cloudLayer.rotation.y = -t * 0.17;

  if (isSurfaceScene) {
    ambient.intensity = 0.06 + daylight * 0.24 + secondStrength * 0.13;
    ambient.color.setRGB(
      THREE.MathUtils.lerp(0.25, 0.56, daylight),
      THREE.MathUtils.lerp(0.32, 0.72, daylight),
      THREE.MathUtils.lerp(0.58, 0.92, daylight),
    );
    scene.fog.color.setRGB(
      THREE.MathUtils.lerp(0.01, 0.23, daylight),
      THREE.MathUtils.lerp(0.02, 0.35, daylight),
      THREE.MathUtils.lerp(0.07, 0.52, daylight),
    );
    scene.background.setRGB(
      THREE.MathUtils.lerp(0.004, 0.2, daylight),
      THREE.MathUtils.lerp(0.01, 0.3, daylight),
      THREE.MathUtils.lerp(0.04, 0.5, daylight),
    );
    scene.fog.density = THREE.MathUtils.lerp(0.078, 0.034, daylight);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(0.46, 0.9, daylight) + secondStrength * 0.06;
    stars.material.opacity = THREE.MathUtils.lerp(0.92, 0.08, daylight);
  } else if (isExternalScene) {
    ambient.intensity = 0.0;
    ambient.color.setRGB(0.0, 0.0, 0.0);
    scene.background.setHex(0x02030f);
    scene.fog.color.setHex(0x02030f);
    scene.fog.density = 0.019;
    renderer.toneMappingExposure = 0.86;
    stars.material.opacity = 0.95;
  }

  if (isExternalScene) {
    binaryStarALight.intensity = 8600;
    binaryStarBLight.intensity = 6400;
    binaryFill.intensity = 0.0;
    planetAtmosphere.material.uniforms.uIntensity.value = 0.22;
  } else {
    binaryStarALight.intensity = 2200 + dayStrength * 6200;
    binaryStarBLight.intensity = 260 + secondStrength * 4200;
    binaryFill.intensity = 0.12 + daylight * 0.75 + secondStrength * 0.24;
    planetAtmosphere.material.uniforms.uIntensity.value = 0.38;
  }

  if (timeIndicator) {
    if (isExternalScene) {
      timeIndicator.textContent = "System View";
    } else {
      const phaseText = Math.max(orbit.primaryAltitude, orbit.secondaryAltitude) > 0.0 ? "Day" : "Night";
      timeIndicator.textContent = `Time ${format24Hour(binaryDayHours)} ${phaseText}`;
    }
  }

  if (isExternalScene) {
    const autoAngleBinary = t * 0.11;
    const extAutoPos = new THREE.Vector3(
      Math.cos(autoAngleBinary) * 32,
      12 + Math.sin(t * 0.13) * 3,
      Math.sin(autoAngleBinary) * 32,
    );
    camera.position.lerp(extAutoPos, cinematicMix * 0.05);
    controls.target.lerp(new THREE.Vector3(0, 0, 0), cinematicMix * 0.06);
  } else {
    if (cinematicMix > 0.001) {
      // Sun-track mode rotates aim only while preserving camera position and orbit distance.
      const followDistance = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target), 6, 18);
      const primaryTarget = camera.position.clone().add(primaryDir.clone().multiplyScalar(followDistance));
      controls.target.lerp(primaryTarget, cinematicMix * 0.14);
    }
    if (camera.position.y < 1.0) camera.position.y = 1.0;
    camera.up.set(0, 1, 0);

    surfaceSky.position.copy(camera.position);
    surfaceGround.position.x = camera.position.x;
    surfaceGround.position.z = camera.position.z;
    surfaceOcean.position.x = camera.position.x;
    surfaceOcean.position.z = camera.position.z;
    surfaceOcean.material.uniforms.time.value = t * 0.42;

    const mixedSunDir = primaryDir
      .clone()
      .multiplyScalar(Math.max(0.05, dayStrength))
      .add(secondaryDir.clone().multiplyScalar(Math.max(0.0, secondStrength * 1.2)))
      .normalize();
    surfaceOcean.material.uniforms.sunDirection.value.copy(mixedSunDir);
    surfaceOcean.material.uniforms.distortionScale.value = 1.6 + beat * 1.2 + nightness * 1.1 + twilight * 0.45;
    surfaceOcean.material.uniforms.waterColor.value.setRGB(
      THREE.MathUtils.lerp(0.03, 0.09, daylight),
      THREE.MathUtils.lerp(0.1, 0.35, daylight),
      THREE.MathUtils.lerp(0.24, 0.62, daylight),
    );

    // Surface suns are rendered by the sky shader; keep billboards disabled to avoid edge artifacts.
    surfaceSunA.group.visible = false;
    surfaceSunB.group.visible = false;
    surfaceReflectionA.visible = false;
    surfaceReflectionB.visible = false;

    binaryStarALight.position.copy(camera.position).add(primaryDir.clone().multiplyScalar(90));
    binaryStarBLight.position.copy(camera.position).add(secondaryDir.clone().multiplyScalar(84));
    binaryStarALight.intensity = 18 + dayStrength * 8400;
    binaryStarBLight.intensity = 4 + secondStrength * 7600;
    binaryFill.intensity = 0.08 + dayStrength * 0.32 + secondStrength * 0.24;

    surfaceGround.material.color.setRGB(
      THREE.MathUtils.lerp(0.04, 0.22, daylight),
      THREE.MathUtils.lerp(0.06, 0.28, daylight),
      THREE.MathUtils.lerp(0.11, 0.33, daylight),
    );
    surfaceSky.material.uniforms.uDay.value = THREE.MathUtils.clamp(daylight, 0.0, 1.0);
    surfaceSky.material.uniforms.uTwilight.value = THREE.MathUtils.clamp(twilight, 0.0, 1.0);
    surfaceSky.material.uniforms.uSecond.value = secondStrength;
    surfaceSky.material.uniforms.uA.value.copy(primaryDir);
    surfaceSky.material.uniforms.uB.value.copy(secondaryDir);
  }

  stars.rotation.y = t * 0.004;
  sky.rotation.y = -t * 0.003;
  if (isSurfaceScene) {
    bloomPass.strength = 0.18 + secondStrength * 0.14 + beat * 0.06;
    bloomPass.radius = 0.14 + secondStrength * 0.08;
    bloomPass.threshold = 0.9;
  } else if (isExternalScene) {
    bloomPass.strength = 0.24 + beat * 0.05;
    bloomPass.radius = 0.14;
    bloomPass.threshold = 0.93;
  } else {
    bloomPass.strength = 0.32 + beat * 0.08;
    bloomPass.radius = 0.18;
    bloomPass.threshold = 0.9;
  }
  crtPass.uniforms.uTime.value = t;
  crtPass.uniforms.uBeat.value = Math.min(1.0, beat * 0.9 + level * 0.35);
  crtPass.uniforms.uGlitch.value = isSurfaceScene ? 0.04 + secondStrength * 0.1 : 0.1;

  if (debugView) {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }

  return {
    dayPhase,
    secondStrength,
    scene: activeSceneKey,
    time24: format24Hour(binaryDayHours),
    primaryAltitudeDeg: THREE.MathUtils.radToDeg(orbit.primaryAltitude),
    secondaryAltitudeDeg: THREE.MathUtils.radToDeg(orbit.secondaryAltitude),
    primaryAzimuthDeg: THREE.MathUtils.radToDeg(orbit.primaryAzimuth),
    secondaryAzimuthDeg: THREE.MathUtils.radToDeg(orbit.secondaryAzimuth),
    schematic: {
      starA: [orbit.starAPosition.x, orbit.starAPosition.z],
      starB: [orbit.starBPosition.x, orbit.starBPosition.z],
      planet: [orbit.planetPosition.x, orbit.planetPosition.z],
      spinDir: [orbit.spinDir.x, orbit.spinDir.y],
      viewerDir: [orbit.viewerDir.x, orbit.viewerDir.y],
      combinedStarDir: [orbit.combinedStarDir.x, orbit.combinedStarDir.y],
      viewerLightDot: orbit.viewerLightDot,
      viewerTurnYaw: orbit.viewerTurnYaw,
      spinYaw: orbit.spinYaw,
      viewerYaw: orbit.viewerYaw,
      orbitRadius: orbit.orbitRadius,
    },
    viewerInset: {
      latitudeDeg: THREE.MathUtils.radToDeg(orbit.observerLatitude),
      observerNormal: [orbit.observerNormal.x, orbit.observerNormal.y, orbit.observerNormal.z],
      viewerTangent: [orbit.viewerTangentWorld.x, orbit.viewerTangentWorld.y, orbit.viewerTangentWorld.z],
      primaryDir: [orbit.primaryDir.x, orbit.primaryDir.y, orbit.primaryDir.z],
      secondaryDir: [orbit.secondaryDir.x, orbit.secondaryDir.y, orbit.secondaryDir.z],
      viewerLightDot: orbit.viewerLightDot,
    },
  };
}
