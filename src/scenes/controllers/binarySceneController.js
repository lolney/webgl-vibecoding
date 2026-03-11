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
    nebulaShell,
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
    surfaceOceanGeometry,
    surfaceFarOcean,
    surfaceOceanBasePos,
    surfaceFarOceanGeometry,
    surfaceFarOceanBasePos,
    surfaceSunA,
    surfaceSunB,
    surfaceReflectionA,
    surfaceReflectionB,
    bloomPass,
    crtPass,
    timeIndicator,
    format24Hour,
    planetOrbitRadius,
    displaceWaterGeometry,
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
    surfaceYaw = null,
    surfacePitch = 0,
    debugView,
  } = frame;

  const isSurfaceScene = activeSceneKey === "binarySurface";
  const isExternalScene = activeSceneKey === "binaryExternal";

  const orbit = computeBinarySimulationState({
    binaryDayHours,
    simulationDays: binarySimulationDays,
    planetOrbitRadius,
    cameraPosition: camera.position,
    cameraTarget: controls.target,
    observerLatitude: THREE.MathUtils.degToRad(observerLatitudeDeg || 0),
    observerLongitude: THREE.MathUtils.degToRad(observerLongitudeDeg || 0),
    viewerHeadingYaw: isSurfaceScene ? surfaceYaw : null,
    viewerPitch: isSurfaceScene ? surfacePitch : 0,
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
    combinedStarWorld,
    primaryLocalDir,
    secondaryLocalDir,
  } = orbit;

  const nightness = 1 - daylight;
  const maxSunAltitude = Math.max(orbit.primaryAltitude, orbit.secondaryAltitude);
  const sunHeight01 = THREE.MathUtils.clamp(Math.sin(Math.max(0, maxSunAltitude)), 0, 1);
  const primaryVisible = orbit.primaryAltitude > THREE.MathUtils.degToRad(-8);
  const secondaryVisible = orbit.secondaryAltitude > THREE.MathUtils.degToRad(-8);

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
      THREE.MathUtils.lerp(0.01, 0.19, daylight),
      THREE.MathUtils.lerp(0.02, 0.29, daylight),
      THREE.MathUtils.lerp(0.07, 0.44, daylight),
    );
    scene.background.setRGB(
      THREE.MathUtils.lerp(0.004, 0.15, daylight),
      THREE.MathUtils.lerp(0.01, 0.24, daylight),
      THREE.MathUtils.lerp(0.04, 0.42, daylight),
    );
    scene.fog.density = THREE.MathUtils.lerp(0.09, 0.038, daylight);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(0.34, 0.47, daylight) + secondStrength * 0.015;
    stars.material.opacity = THREE.MathUtils.lerp(0.96, 0.12, daylight);
    stars.material.size = THREE.MathUtils.lerp(0.24, 0.06, daylight);
  } else if (isExternalScene) {
    ambient.intensity = 0.0;
    ambient.color.setRGB(0.0, 0.0, 0.0);
    scene.background.setHex(0x02030f);
    scene.fog.color.setHex(0x02030f);
    scene.fog.density = 0.019;
    renderer.toneMappingExposure = 0.86;
    stars.material.opacity = 0.95;
    stars.material.size = 0.08;
  }

  if (isExternalScene) {
    binaryStarALight.intensity = 8600;
    binaryStarBLight.intensity = 6400;
    binaryFill.intensity = 0.0;
    planetAtmosphere.material.uniforms.uIntensity.value = 0.22;
  } else {
    binaryStarALight.intensity = 1200 + dayStrength * 2800;
    binaryStarBLight.intensity = 140 + secondStrength * 1800;
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
    const autoAngleBinary = t * 0.065 + Math.sin(t * 0.08) * 0.24;
    const extAutoPos = new THREE.Vector3(
      Math.cos(autoAngleBinary) * 30,
      10.5 + Math.sin(t * 0.11) * 2.2,
      Math.sin(autoAngleBinary) * 28,
    );
    camera.position.lerp(extAutoPos, cinematicMix * 0.05);
    controls.target.lerp(
      new THREE.Vector3(
        Math.sin(t * 0.09) * 1.1,
        Math.sin(t * 0.05) * 0.55,
        Math.cos(t * 0.07) * 0.8,
      ),
      cinematicMix * 0.06,
    );
  } else {
    if (camera.position.y < 1.0) camera.position.y = 1.0;
    camera.up.set(0, 1, 0);
    const horizonBoost = 1 - sunHeight01;
    const surfaceForward = controls.target.clone().sub(camera.position).setY(0);
    if (surfaceForward.lengthSq() < 1e-6) {
      surfaceForward.set(0, 0, -1);
    } else {
      surfaceForward.normalize();
    }
    const surfaceRight = new THREE.Vector3().crossVectors(surfaceForward, new THREE.Vector3(0, 1, 0)).normalize();
    const surfaceYawAngle = Math.atan2(surfaceForward.x, surfaceForward.z);

    surfaceSky.visible = true;
    surfaceSky.position.copy(camera.position);
    surfaceSky.rotation.set(0, 0, 0);
    surfaceGround.visible = false;
    surfaceGround.rotation.set(-Math.PI / 2, 0, 0);
    surfaceGround.position.set(camera.position.x, -0.14, camera.position.z);
    const surfaceSunDir = primaryLocalDir.clone().multiplyScalar(Math.max(0.4, dayStrength)).add(
      secondaryLocalDir.clone().multiplyScalar(Math.max(0.12, secondStrength * 0.7)),
    );
    if (surfaceSunDir.lengthSq() < 1e-6) surfaceSunDir.set(0.2, 0.9, 0.35);
    surfaceSunDir.normalize();

    surfaceOcean.visible = true;
    surfaceFarOcean.visible = true;
    surfaceOcean.rotation.set(-Math.PI / 2, 0, 0);
    surfaceFarOcean.rotation.set(-Math.PI / 2 + 0.1, surfaceYawAngle, 0);
    surfaceOcean.position.copy(camera.position).add(surfaceForward.clone().multiplyScalar(18));
    surfaceOcean.position.y = camera.position.y - 1.82;
    surfaceFarOcean.position.copy(camera.position).add(surfaceForward.clone().multiplyScalar(180));
    surfaceFarOcean.position.y = camera.position.y - 1.58;
    surfaceOcean.scale.set(118, 104, 0.22);
    surfaceFarOcean.scale.set(168, 128, 0.16);
    displaceWaterGeometry(surfaceOceanGeometry, surfaceOceanBasePos, t * 0.78, 0.92 + horizonBoost * 0.22);
    displaceWaterGeometry(surfaceFarOceanGeometry, surfaceFarOceanBasePos, t * 0.6 + 5.0, 0.68 + horizonBoost * 0.16);
    surfaceOcean.material.uniforms.time.value = t * 0.34;
    surfaceOcean.material.uniforms.sunDirection.value.copy(surfaceSunDir);
    surfaceOcean.material.uniforms.sunColor.value.setRGB(
      THREE.MathUtils.lerp(0.12, 0.19, dayStrength),
      THREE.MathUtils.lerp(0.14, 0.22, dayStrength),
      THREE.MathUtils.lerp(0.18, 0.26, dayStrength),
    );
    surfaceOcean.material.uniforms.distortionScale.value = THREE.MathUtils.lerp(0.48, 0.9, horizonBoost);
    surfaceOcean.material.uniforms.size.value = THREE.MathUtils.lerp(2.2, 2.8, horizonBoost);
    surfaceOcean.material.uniforms.waterColor.value.set(daylight > 0.35 ? 0x0a2742 : 0x07162a);
    surfaceFarOcean.material.uniforms.time.value = t * 0.24 + 8.0;
    surfaceFarOcean.material.uniforms.sunDirection.value.copy(surfaceSunDir);
    surfaceFarOcean.material.uniforms.sunColor.value.setRGB(
      THREE.MathUtils.lerp(0.14, 0.24, dayStrength),
      THREE.MathUtils.lerp(0.16, 0.28, dayStrength),
      THREE.MathUtils.lerp(0.2, 0.34, dayStrength),
    );
    surfaceFarOcean.material.uniforms.distortionScale.value = THREE.MathUtils.lerp(0.72, 1.2, horizonBoost);
    surfaceFarOcean.material.uniforms.size.value = THREE.MathUtils.lerp(2.8, 3.6, horizonBoost);
    surfaceFarOcean.material.uniforms.waterColor.value.set(daylight > 0.35 ? 0x103654 : 0x0a1d35);

    // Explicit sun billboards keep the solar motion readable in the local sky frame.
    surfaceSunA.group.visible = primaryVisible;
    surfaceSunB.group.visible = secondaryVisible;
    surfaceReflectionA.visible = false;
    surfaceReflectionB.visible = false;

    if (primaryVisible) {
      surfaceSunA.group.position.copy(camera.position).add(primaryLocalDir.clone().multiplyScalar(86));
      surfaceSunA.group.lookAt(camera.position);
      surfaceSunA.glow.visible = true;
      surfaceSunA.glow.material.uniforms.uStrength.value = 0.22 + (1 - sunHeight01) * 0.28 + dayStrength * 0.08;
      surfaceSunA.group.scale.setScalar(1.08 + (1 - sunHeight01) * 0.42);

      const primaryAhead = Math.max(0, primaryLocalDir.dot(surfaceForward));
      const primaryRight = primaryLocalDir.dot(surfaceRight);
      const primaryReflection = primaryAhead * THREE.MathUtils.clamp(1 - sunHeight01 * 1.35, 0, 1);
      if (primaryReflection > 0.035) {
        surfaceReflectionA.visible = true;
        surfaceReflectionA.position.copy(camera.position)
          .add(surfaceForward.clone().multiplyScalar(70 + primaryAhead * 34))
          .add(surfaceRight.clone().multiplyScalar(primaryRight * 26));
        surfaceReflectionA.position.y = camera.position.y - 1.76;
        surfaceReflectionA.rotation.set(-Math.PI / 2, 0, -primaryRight * 0.16);
        surfaceReflectionA.scale.set(0.42, 0.34, 1);
        surfaceReflectionA.material.opacity = 0.008 + primaryReflection * 0.035;
      }
    }

    if (secondaryVisible) {
      surfaceSunB.group.position.copy(camera.position).add(secondaryLocalDir.clone().multiplyScalar(82));
      surfaceSunB.group.lookAt(camera.position);
      surfaceSunB.glow.visible = true;
      surfaceSunB.glow.material.uniforms.uStrength.value = 0.14 + (1 - sunHeight01) * 0.18 + secondStrength * 0.08;
      surfaceSunB.group.scale.setScalar(0.94 + (1 - sunHeight01) * 0.3);

      const secondaryAhead = Math.max(0, secondaryLocalDir.dot(surfaceForward));
      const secondaryRight = secondaryLocalDir.dot(surfaceRight);
      const secondaryReflection = secondaryAhead * THREE.MathUtils.clamp(1 - sunHeight01 * 1.5, 0, 1);
      if (secondaryReflection > 0.03) {
        surfaceReflectionB.visible = true;
        surfaceReflectionB.position.copy(camera.position)
          .add(surfaceForward.clone().multiplyScalar(64 + secondaryAhead * 28))
          .add(surfaceRight.clone().multiplyScalar(secondaryRight * 22));
        surfaceReflectionB.position.y = camera.position.y - 1.77;
        surfaceReflectionB.rotation.set(-Math.PI / 2, 0, -secondaryRight * 0.14);
        surfaceReflectionB.scale.set(0.38, 0.3, 1);
        surfaceReflectionB.material.opacity = 0.006 + secondaryReflection * 0.028;
      }
    }

    binaryStarALight.position.copy(camera.position).add(primaryLocalDir.clone().multiplyScalar(90));
    binaryStarBLight.position.copy(camera.position).add(secondaryLocalDir.clone().multiplyScalar(84));
    binaryStarALight.intensity = 18 + dayStrength * (70 + (1 - sunHeight01) * 34);
    binaryStarBLight.intensity = 4 + secondStrength * (38 + (1 - sunHeight01) * 24);
    binaryFill.intensity = 0.08 + dayStrength * 0.32 + secondStrength * 0.24;

    surfaceGround.material.color.setRGB(
      THREE.MathUtils.lerp(0.01, 0.06, daylight),
      THREE.MathUtils.lerp(0.015, 0.08, daylight),
      THREE.MathUtils.lerp(0.03, 0.1, daylight),
    );
    surfaceSky.material.uniforms.uDay.value = THREE.MathUtils.clamp(daylight, 0.0, 1.0);
    surfaceSky.material.uniforms.uTwilight.value = THREE.MathUtils.clamp(twilight, 0.0, 1.0);
    surfaceSky.material.uniforms.uSecond.value = secondStrength;
    surfaceSky.material.uniforms.uA.value.copy(primaryLocalDir);
    surfaceSky.material.uniforms.uB.value.copy(secondaryLocalDir);
  }

  stars.rotation.y = t * 0.004;
  nebulaShell.rotation.y = -t * 0.0025;
  nebulaShell.material.uniforms.uOpacity.value = isExternalScene ? 0.2 : (isSurfaceScene ? 0.08 : 0.14);
  sky.rotation.y = -t * 0.003;
  if (isSurfaceScene) {
    const horizonBoost = 1 - sunHeight01;
    bloomPass.strength = 0.006 + horizonBoost * 0.016 + secondStrength * 0.012 + beat * 0.008;
    bloomPass.radius = 0.02 + horizonBoost * 0.018 + secondStrength * 0.012;
    bloomPass.threshold = THREE.MathUtils.lerp(0.9995, 0.986, horizonBoost);
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
      spinDir: [orbit.siteDirWorld.x, orbit.siteDirWorld.y],
      viewerDir: [orbit.viewerDir.x, orbit.viewerDir.y],
      combinedStarDir: [orbit.combinedStarDir.x, orbit.combinedStarDir.y],
      viewerLightDot: orbit.viewerLightDot,
      primaryAltitudeDeg: THREE.MathUtils.radToDeg(orbit.primaryAltitude),
      secondaryAltitudeDeg: THREE.MathUtils.radToDeg(orbit.secondaryAltitude),
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
