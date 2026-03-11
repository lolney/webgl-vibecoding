import * as THREE from "three";
import { computeBinarySimulationState } from "../shared/orbital.js";
import { computeLightingState, lightingDebugState } from "../shared/lighting.js";

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
    binaryAmbient,
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
    surfaceHaze,
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
  const lighting = computeLightingState(orbit);
  const { primary, secondary } = lighting;
  const {
    transport,
    skyResponse,
    surfaceResponse,
    illumination,
    display,
    aerialPerspective,
  } = lighting;

  starAGroup.position.copy(orbit.starAPosition);
  starBGroup.position.copy(orbit.starBPosition);
  binaryStarALight.position.copy(starAGroup.position);
  binaryStarBLight.position.copy(starBGroup.position);

  planetPivot.position.copy(orbit.planetPosition);
  planetGroup.rotation.y = orbit.spinYaw;
  cloudLayer.rotation.y = -t * 0.17;

  if (isSurfaceScene) {
    binaryAmbient.intensity = illumination.ambientLux;
    binaryAmbient.color.copy(skyResponse.ambientColor);
    scene.fog.color.copy(aerialPerspective.surface.hazeColor);
    scene.background.copy(skyResponse.backgroundColor);
    scene.fog.density = skyResponse.fogDensity * 0.72 + aerialPerspective.surface.hazeOpacity * 0.045;
    renderer.toneMappingExposure = display.exposure;
    stars.material.opacity = THREE.MathUtils.lerp(0.96, 0.12, transport.daylight);
    stars.material.size = THREE.MathUtils.lerp(0.24, 0.06, transport.daylight);
  } else if (isExternalScene) {
    binaryAmbient.intensity = 0.0;
    binaryAmbient.color.setRGB(0.0, 0.0, 0.0);
    scene.background.copy(skyResponse.backgroundColor.clone().multiplyScalar(0.32));
    scene.fog.color.copy(aerialPerspective.external.fogColor);
    scene.fog.density = aerialPerspective.external.fogDensity;
    renderer.toneMappingExposure = 0.86;
    stars.material.opacity = 0.95;
    stars.material.size = 0.08;
  }

  if (isExternalScene) {
    binaryStarALight.intensity = 8600;
    binaryStarBLight.intensity = 6400;
    binaryFill.intensity = 0.0;
    planetAtmosphere.material.uniforms.uIntensity.value = aerialPerspective.external.atmosphereBoost;
  } else {
    binaryStarALight.intensity = illumination.primaryLightIntensity;
    binaryStarBLight.intensity = illumination.secondaryLightIntensity;
    binaryFill.intensity = illumination.fillLux;
    planetAtmosphere.material.uniforms.uIntensity.value = illumination.atmosphereIntensity;
  }
  surfaceHaze.visible = isSurfaceScene;

  if (timeIndicator) {
    if (isExternalScene) {
      timeIndicator.textContent = "System View";
    } else {
      const phaseText = Math.max(primary.altitudeDeg, secondary.altitudeDeg) > 0.0 ? "Day" : "Night";
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
    surfaceHaze.visible = true;
    surfaceHaze.position.copy(camera.position)
      .add(surfaceForward.clone().multiplyScalar(aerialPerspective.surface.hazeDistance));
    surfaceHaze.position.y = camera.position.y - 2.1;
    surfaceHaze.scale.set(1.0, aerialPerspective.surface.hazeHeight, 1.0);
    surfaceHaze.lookAt(camera.position);
    surfaceHaze.material.uniforms.uColor.value.copy(aerialPerspective.surface.hazeColor);
    surfaceHaze.material.uniforms.uOpacity.value = aerialPerspective.surface.hazeOpacity;
    surfaceGround.visible = false;
    surfaceGround.rotation.set(-Math.PI / 2, 0, 0);
    surfaceGround.position.set(camera.position.x, -0.14, camera.position.z);

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
    displaceWaterGeometry(
      surfaceOceanGeometry,
      surfaceOceanBasePos,
      t * 0.78,
      0.92 + primary.horizonFactor * 0.22,
    );
    displaceWaterGeometry(
      surfaceFarOceanGeometry,
      surfaceFarOceanBasePos,
      t * 0.6 + 5.0,
      0.68 + primary.horizonFactor * 0.16,
    );
    surfaceOcean.material.uniforms.time.value = t * 0.34;
    surfaceOcean.material.uniforms.sunDirection.value.copy(surfaceResponse.combinedSunDirection);
    surfaceOcean.material.uniforms.sunColor.value.copy(surfaceResponse.waterSunColor);
    surfaceOcean.material.uniforms.distortionScale.value = surfaceResponse.distortionNear;
    surfaceOcean.material.uniforms.size.value = surfaceResponse.sizeNear;
    surfaceOcean.material.uniforms.waterColor.value.copy(surfaceResponse.nearWaterColor);
    surfaceFarOcean.material.uniforms.time.value = t * 0.24 + 8.0;
    surfaceFarOcean.material.uniforms.sunDirection.value.copy(surfaceResponse.combinedSunDirection);
    surfaceFarOcean.material.uniforms.sunColor.value.copy(surfaceResponse.farWaterSunColor);
    surfaceFarOcean.material.uniforms.distortionScale.value = surfaceResponse.distortionFar;
    surfaceFarOcean.material.uniforms.size.value = surfaceResponse.sizeFar;
    surfaceFarOcean.material.uniforms.waterColor.value.copy(surfaceResponse.farWaterColor);
    if (surfaceOcean.material.uniforms.alpha) {
      surfaceOcean.material.uniforms.alpha.value = 0.96;
    }
    if (surfaceFarOcean.material.uniforms.alpha) {
      surfaceFarOcean.material.uniforms.alpha.value = aerialPerspective.surface.farAlpha;
    }

    surfaceSunA.group.visible = primary.visibleFactor > 0.01;
    surfaceSunB.group.visible = secondary.visibleFactor > 0.01;
    surfaceReflectionA.visible = false;
    surfaceReflectionB.visible = false;

    if (surfaceSunA.group.visible) {
      surfaceSunA.group.position.copy(camera.position).add(orbit.primaryLocalDir.clone().multiplyScalar(86));
      surfaceSunA.group.lookAt(camera.position);
      surfaceSunA.core.material.uniforms.uColor.value.copy(primary.apparentColor);
      surfaceSunA.core.material.uniforms.uIntensity.value = primary.discIntensity;
      surfaceSunA.glow.visible = true;
      surfaceSunA.glow.material.uniforms.uColor.value.copy(primary.apparentColor);
      surfaceSunA.glow.material.uniforms.uStrength.value = primary.haloStrength;
      surfaceSunA.glow.material.uniforms.uIntensity.value = 0.9 + primary.horizonFactor * 0.35;
      surfaceSunA.group.scale.setScalar(primary.discScale);

      const primaryAhead = Math.max(0, orbit.primaryLocalDir.dot(surfaceForward));
      const primaryRight = orbit.primaryLocalDir.dot(surfaceRight);
      const primaryReflection = primaryAhead * primary.reflectionGain;
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

    if (surfaceSunB.group.visible) {
      surfaceSunB.group.position.copy(camera.position).add(orbit.secondaryLocalDir.clone().multiplyScalar(82));
      surfaceSunB.group.lookAt(camera.position);
      surfaceSunB.core.material.uniforms.uColor.value.copy(secondary.apparentColor);
      surfaceSunB.core.material.uniforms.uIntensity.value = secondary.discIntensity;
      surfaceSunB.glow.visible = true;
      surfaceSunB.glow.material.uniforms.uColor.value.copy(secondary.apparentColor);
      surfaceSunB.glow.material.uniforms.uStrength.value = secondary.haloStrength;
      surfaceSunB.glow.material.uniforms.uIntensity.value = 0.8 + secondary.horizonFactor * 0.28;
      surfaceSunB.group.scale.setScalar(secondary.discScale * 0.9);

      const secondaryAhead = Math.max(0, orbit.secondaryLocalDir.dot(surfaceForward));
      const secondaryRight = orbit.secondaryLocalDir.dot(surfaceRight);
      const secondaryReflection = secondaryAhead * secondary.reflectionGain;
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

    binaryStarALight.position.copy(camera.position).add(orbit.primaryLocalDir.clone().multiplyScalar(90));
    binaryStarBLight.position.copy(camera.position).add(orbit.secondaryLocalDir.clone().multiplyScalar(84));
    binaryStarALight.color.copy(primary.apparentColor);
    binaryStarBLight.color.copy(secondary.apparentColor);
    binaryStarALight.intensity = illumination.primaryLightIntensity;
    binaryStarBLight.intensity = illumination.secondaryLightIntensity;
    binaryFill.intensity = illumination.fillLux;

    surfaceGround.material.color.setRGB(
      THREE.MathUtils.lerp(0.01, 0.06, transport.daylight),
      THREE.MathUtils.lerp(0.015, 0.08, transport.daylight),
      THREE.MathUtils.lerp(0.03, 0.1, transport.daylight),
    );
    surfaceSky.material.uniforms.uZenithColor.value.copy(skyResponse.zenithColor);
    surfaceSky.material.uniforms.uHorizonColor.value.copy(skyResponse.horizonColor);
    surfaceSky.material.uniforms.uNightZenith.value.copy(skyResponse.nightZenith);
    surfaceSky.material.uniforms.uNightHorizon.value.copy(skyResponse.nightHorizon);
    surfaceSky.material.uniforms.uRayleighColor.value.copy(skyResponse.rayleighColor);
    surfaceSky.material.uniforms.uMieColorA.value.copy(skyResponse.mieColorA);
    surfaceSky.material.uniforms.uMieColorB.value.copy(skyResponse.mieColorB);
    surfaceSky.material.uniforms.uSunDirA.value.copy(orbit.primaryLocalDir);
    surfaceSky.material.uniforms.uSunDirB.value.copy(orbit.secondaryLocalDir);
    surfaceSky.material.uniforms.uDayStrength.value = transport.daylight;
    surfaceSky.material.uniforms.uTwilightStrength.value = transport.twilight;
    surfaceSky.material.uniforms.uNightStrength.value = transport.night;
    surfaceSky.material.uniforms.uHaze.value = transport.haze;
    surfaceSky.material.uniforms.uScatterStrengthA.value = skyResponse.scatterStrengthA;
    surfaceSky.material.uniforms.uScatterStrengthB.value = skyResponse.scatterStrengthB;
    surfaceSky.material.uniforms.uMieStrengthA.value = skyResponse.mieStrengthA;
    surfaceSky.material.uniforms.uMieStrengthB.value = skyResponse.mieStrengthB;
  }

  stars.rotation.y = t * 0.004;
  nebulaShell.rotation.y = -t * 0.0025;
  nebulaShell.material.uniforms.uOpacity.value = isExternalScene
    ? aerialPerspective.external.nebulaOpacity
    : (isSurfaceScene ? 0.08 : 0.14);
  sky.rotation.y = -t * 0.003;
  if (isSurfaceScene) {
    bloomPass.strength = display.bloomStrength + beat * 0.008;
    bloomPass.radius = display.bloomRadius;
    bloomPass.threshold = display.bloomThreshold;
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
  crtPass.uniforms.uGlitch.value = isSurfaceScene ? 0.04 + secondary.directIlluminanceLux / 100000 * 0.16 : 0.1;

  if (debugView) {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }

  return {
    dayPhase: orbit.dayPhase,
    secondStrength: secondary.directIlluminanceLux / 100000,
    scene: activeSceneKey,
    time24: format24Hour(binaryDayHours),
    primaryAltitudeDeg: primary.altitudeDeg,
    secondaryAltitudeDeg: secondary.altitudeDeg,
    primaryAzimuthDeg: primary.azimuthDeg,
    secondaryAzimuthDeg: secondary.azimuthDeg,
    schematic: {
      starA: [orbit.starAPosition.x, orbit.starAPosition.z],
      starB: [orbit.starBPosition.x, orbit.starBPosition.z],
      planet: [orbit.planetPosition.x, orbit.planetPosition.z],
      spinDir: [orbit.siteDirWorld.x, orbit.siteDirWorld.y],
      viewerDir: [orbit.viewerDir.x, orbit.viewerDir.y],
      combinedStarDir: [orbit.combinedStarDir.x, orbit.combinedStarDir.y],
      viewerLightDot: orbit.viewerLightDot,
      primaryAltitudeDeg: primary.altitudeDeg,
      secondaryAltitudeDeg: secondary.altitudeDeg,
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
    lighting: lightingDebugState(lighting),
  };
}
