import * as THREE from "three";
import { computeBinarySimulationState } from "../shared/orbital.js";
import { computeLightingState, lightingDebugState } from "../shared/lighting.js";

const EXTERNAL_BACKGROUND = new THREE.Color(0x02050d);
const EXTERNAL_FOG_COLOR = new THREE.Color(0x071120);

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
    planetMesh,
    starAGroup,
    starAVisual,
    starBGroup,
    starBVisual,
    planetPivot,
    planetGroup,
    cloudLayer,
    surfaceGround,
    surfaceSky,
    surfaceHaze,
    surfaceScatterBand,
    surfaceOcean,
    surfaceOceanGeometry,
    surfaceFarOcean,
    surfaceOceanBasePos,
    surfaceFarOceanGeometry,
    surfaceFarOceanBasePos,
    surfaceSunA,
    surfaceSunB,
    surfaceBeamA,
    surfaceBeamB,
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
    observerLatitudeTravelDeg,
    observerLongitudeBaseDeg,
    observerLatitudeDeg,
    observerLongitudeDeg,
    surfaceViewerForwardWorld = null,
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
    observerLatitude: THREE.MathUtils.degToRad(
      isSurfaceScene ? (observerLatitudeTravelDeg || 0) : (observerLatitudeDeg || 0),
    ),
    observerLongitude: THREE.MathUtils.degToRad(
      isSurfaceScene ? (observerLongitudeBaseDeg || 0) : (observerLongitudeDeg || 0),
    ),
    viewerForwardWorld: isSurfaceScene && surfaceViewerForwardWorld instanceof THREE.Vector3
      ? surfaceViewerForwardWorld
      : null,
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
    volumetrics,
  } = lighting;

  starAGroup.position.copy(orbit.starAPosition);
  starBGroup.position.copy(orbit.starBPosition);
  binaryStarALight.position.copy(starAGroup.position);
  binaryStarBLight.position.copy(starBGroup.position);

  if (starAVisual?.core?.material?.uniforms) {
    starAVisual.core.material.uniforms.uCore.value.copy(primary.apparentColor).lerp(new THREE.Color(0xfff9e5), 0.28);
    starAVisual.core.material.uniforms.uGlow.value.copy(primary.apparentColor);
    starAVisual.innerShell.material.uniforms.uColor.value.copy(primary.apparentColor);
    starAVisual.innerShell.material.uniforms.uAlpha.value = THREE.MathUtils.lerp(0.16, 0.34, primary.horizonFactor + primary.visibleFactor * 0.18);
    starAVisual.outerShell.material.uniforms.uColor.value.copy(primary.apparentColor).lerp(new THREE.Color(0xffd59a), 0.22);
    starAVisual.outerShell.material.uniforms.uAlpha.value = THREE.MathUtils.lerp(0.08, 0.18, primary.horizonFactor + primary.visibleFactor * 0.12);
  }
  if (starBVisual?.core?.material?.uniforms) {
    starBVisual.core.material.uniforms.uCore.value.copy(secondary.apparentColor).lerp(new THREE.Color(0xe7efff), 0.2);
    starBVisual.core.material.uniforms.uGlow.value.copy(secondary.apparentColor);
    starBVisual.innerShell.material.uniforms.uColor.value.copy(secondary.apparentColor);
    starBVisual.innerShell.material.uniforms.uAlpha.value = THREE.MathUtils.lerp(0.12, 0.24, secondary.horizonFactor + secondary.visibleFactor * 0.14);
    starBVisual.outerShell.material.uniforms.uColor.value.copy(secondary.apparentColor).lerp(new THREE.Color(0xb0c9ff), 0.18);
    starBVisual.outerShell.material.uniforms.uAlpha.value = THREE.MathUtils.lerp(0.06, 0.13, secondary.horizonFactor + secondary.visibleFactor * 0.1);
  }

  planetPivot.position.copy(orbit.planetPosition);
  planetGroup.rotation.y = orbit.spinYaw;
  cloudLayer.rotation.y = -t * 0.17;
  const reflectedLightFactor = THREE.MathUtils.clamp(
    orbit.phaseFractionA * 0.18 + orbit.phaseFractionB * 0.12,
    0,
    0.22,
  );
  planetMesh.material.color.copy(new THREE.Color(0x254b72)).lerp(new THREE.Color(0x4f83b8), transport.daylight * 0.62 + transport.twilight * 0.18);
  planetMesh.material.roughness = THREE.MathUtils.lerp(0.8, 0.46, transport.daylight * 0.72 + transport.twilight * 0.18);
  planetMesh.material.metalness = THREE.MathUtils.lerp(0.03, 0.1, transport.daylight * 0.3);
  planetMesh.material.clearcoat = THREE.MathUtils.lerp(0.08, 0.22, transport.daylight * 0.7 + secondary.visibleFactor * 0.12);
  planetMesh.material.clearcoatRoughness = THREE.MathUtils.lerp(0.42, 0.18, transport.daylight * 0.68);
  planetMesh.material.emissive.copy(primary.apparentColor).multiplyScalar(reflectedLightFactor * 0.55)
    .add(secondary.apparentColor.clone().multiplyScalar(reflectedLightFactor * 0.85));
  planetMesh.material.emissiveIntensity = isExternalScene
    ? THREE.MathUtils.lerp(0.1, 0.46, orbit.combinedPhaseFraction)
    : THREE.MathUtils.lerp(0.03, 0.1, transport.twilight * 0.6 + secondary.visibleFactor * 0.18);
  cloudLayer.material.opacity = THREE.MathUtils.lerp(0.08, 0.18, transport.daylight * 0.74 + transport.twilight * 0.2);
  cloudLayer.material.color.copy(new THREE.Color(0xb8d7ff)).lerp(new THREE.Color(0xe9f3ff), transport.daylight * 0.34);
  cloudLayer.material.roughness = THREE.MathUtils.lerp(0.92, 0.62, transport.daylight * 0.7);
  cloudLayer.material.metalness = 0.0;
  planetAtmosphere.material.uniforms.uColor.value.copy(skyResponse.horizonColor).lerp(skyResponse.zenithColor, 0.28);
  planetAtmosphere.material.uniforms.uLightDirA.value.copy(orbit.primaryDir);
  planetAtmosphere.material.uniforms.uLightDirB.value.copy(orbit.secondaryDir);
  planetAtmosphere.material.uniforms.uLightColorA.value.copy(primary.apparentColor);
  planetAtmosphere.material.uniforms.uLightColorB.value.copy(secondary.apparentColor);
  planetAtmosphere.material.uniforms.uLightStrengthA.value = THREE.MathUtils.lerp(0.18, 1.0, orbit.phaseFractionA);
  planetAtmosphere.material.uniforms.uLightStrengthB.value = THREE.MathUtils.lerp(0.12, 0.8, orbit.phaseFractionB);
  planetAtmosphere.material.uniforms.uNightReflectColor.value.copy(primary.apparentColor).lerp(secondary.apparentColor, 0.42);
  planetAtmosphere.material.uniforms.uNightReflectStrength.value = isExternalScene
    ? reflectedLightFactor
    : reflectedLightFactor * 0.32;

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
    scene.background.copy(EXTERNAL_BACKGROUND);
    scene.fog.color.copy(EXTERNAL_FOG_COLOR);
    scene.fog.density = 0.0085;
    renderer.toneMappingExposure = 0.86;
    stars.material.opacity = 0.95;
    stars.material.size = 0.11;
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
  surfaceScatterBand.visible = false;

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
    surfaceScatterBand.visible = surfaceResponse.scatterBandOpacity > 0.01;
    if (surfaceScatterBand.visible) {
      surfaceScatterBand.position.copy(camera.position)
        .add(surfaceForward.clone().multiplyScalar(surfaceResponse.scatterBandDistance));
      surfaceScatterBand.position.y = camera.position.y - 2.0;
      surfaceScatterBand.scale.set(1.0, surfaceResponse.scatterBandHeight, 1.0);
      surfaceScatterBand.lookAt(camera.position);
      surfaceScatterBand.material.uniforms.uColor.value.copy(surfaceResponse.scatterBandColor);
      surfaceScatterBand.material.uniforms.uOpacity.value = surfaceResponse.scatterBandOpacity;
    }
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
    surfaceBeamA.visible = false;
    surfaceBeamB.visible = false;
    surfaceReflectionA.visible = false;
    surfaceReflectionB.visible = false;

    if (surfaceSunA.group.visible) {
      const sunPosA = camera.position.clone().add(orbit.primaryLocalDir.clone().multiplyScalar(86));
      surfaceSunA.group.position.copy(sunPosA);
      surfaceSunA.group.lookAt(camera.position);
      surfaceSunA.core.material.uniforms.uColor.value.copy(primary.apparentColor);
      surfaceSunA.core.material.uniforms.uIntensity.value = primary.discIntensity;
      surfaceSunA.glow.visible = true;
      surfaceSunA.glow.material.uniforms.uColor.value.copy(primary.apparentColor);
      surfaceSunA.glow.material.uniforms.uStrength.value = primary.haloStrength;
      surfaceSunA.glow.material.uniforms.uIntensity.value = 0.9 + primary.horizonFactor * 0.35;
      surfaceSunA.group.scale.setScalar(primary.discScale);

      if (volumetrics.primaryShaftStrength > 0.015) {
        const shaftDirA = orbit.primaryLocalDir.clone().multiplyScalar(-1).add(new THREE.Vector3(0, -0.62, 0)).normalize();
        const shaftNormalA = camera.position.clone().sub(sunPosA).normalize();
        let shaftRightA = new THREE.Vector3().crossVectors(shaftNormalA, shaftDirA);
        if (shaftRightA.lengthSq() < 1e-5) shaftRightA = new THREE.Vector3(1, 0, 0);
        shaftRightA.normalize();
        const shaftFacingA = new THREE.Vector3().crossVectors(shaftRightA, shaftDirA).normalize();
        const shaftBasisA = new THREE.Matrix4().makeBasis(shaftRightA, shaftDirA, shaftFacingA);
        surfaceBeamA.visible = true;
        surfaceBeamA.position.copy(sunPosA).add(shaftDirA.clone().multiplyScalar(volumetrics.primaryLength * 0.58));
        surfaceBeamA.quaternion.setFromRotationMatrix(shaftBasisA);
        surfaceBeamA.scale.set(volumetrics.primaryRadius * 0.9, volumetrics.primaryLength, volumetrics.primaryRadius * 0.9);
        surfaceBeamA.material.uniforms.uColor.value.copy(primary.apparentColor);
        surfaceBeamA.material.uniforms.uStrength.value = volumetrics.primaryShaftStrength * 1.8;
        surfaceBeamA.material.uniforms.uDensity.value = volumetrics.mediumDensity;
        surfaceBeamA.material.uniforms.uAnisotropy.value = volumetrics.anisotropy;
        surfaceBeamA.material.uniforms.uTime.value = t;
      }

      const primaryAhead = Math.max(0, orbit.primaryLocalDir.dot(surfaceForward));
      const primaryRight = orbit.primaryLocalDir.dot(surfaceRight);
      const primaryReflection = primaryAhead * surfaceResponse.primaryTrailGain * (0.42 + surfaceResponse.glitterWidth * 0.9);
      if (primaryReflection > 0.035) {
        surfaceReflectionA.visible = true;
        surfaceReflectionA.position.copy(camera.position)
          .add(surfaceForward.clone().multiplyScalar(70 + primaryAhead * 34))
          .add(surfaceRight.clone().multiplyScalar(primaryRight * 26));
        surfaceReflectionA.position.y = camera.position.y - 1.76;
        surfaceReflectionA.rotation.set(-Math.PI / 2, 0, -primaryRight * 0.16);
        surfaceReflectionA.scale.set(
          0.38 + surfaceResponse.glitterWidth * 0.12,
          0.28 + surfaceResponse.glitterWidth * 0.22,
          1,
        );
        surfaceReflectionA.material.opacity = 0.003 + primaryReflection * 0.024;
      }
    }

    if (surfaceSunB.group.visible) {
      const sunPosB = camera.position.clone().add(orbit.secondaryLocalDir.clone().multiplyScalar(82));
      surfaceSunB.group.position.copy(sunPosB);
      surfaceSunB.group.lookAt(camera.position);
      surfaceSunB.core.material.uniforms.uColor.value.copy(secondary.apparentColor);
      surfaceSunB.core.material.uniforms.uIntensity.value = secondary.discIntensity;
      surfaceSunB.glow.visible = true;
      surfaceSunB.glow.material.uniforms.uColor.value.copy(secondary.apparentColor);
      surfaceSunB.glow.material.uniforms.uStrength.value = secondary.haloStrength;
      surfaceSunB.glow.material.uniforms.uIntensity.value = 0.8 + secondary.horizonFactor * 0.28;
      surfaceSunB.group.scale.setScalar(secondary.discScale * 0.9);

      if (volumetrics.secondaryShaftStrength > 0.015) {
        const shaftDirB = orbit.secondaryLocalDir.clone().multiplyScalar(-1).add(new THREE.Vector3(0, -0.58, 0)).normalize();
        const shaftNormalB = camera.position.clone().sub(sunPosB).normalize();
        let shaftRightB = new THREE.Vector3().crossVectors(shaftNormalB, shaftDirB);
        if (shaftRightB.lengthSq() < 1e-5) shaftRightB = new THREE.Vector3(1, 0, 0);
        shaftRightB.normalize();
        const shaftFacingB = new THREE.Vector3().crossVectors(shaftRightB, shaftDirB).normalize();
        const shaftBasisB = new THREE.Matrix4().makeBasis(shaftRightB, shaftDirB, shaftFacingB);
        surfaceBeamB.visible = true;
        surfaceBeamB.position.copy(sunPosB).add(shaftDirB.clone().multiplyScalar(volumetrics.secondaryLength * 0.58));
        surfaceBeamB.quaternion.setFromRotationMatrix(shaftBasisB);
        surfaceBeamB.scale.set(volumetrics.secondaryRadius * 0.92, volumetrics.secondaryLength, volumetrics.secondaryRadius * 0.92);
        surfaceBeamB.material.uniforms.uColor.value.copy(secondary.apparentColor);
        surfaceBeamB.material.uniforms.uStrength.value = volumetrics.secondaryShaftStrength * 1.8;
        surfaceBeamB.material.uniforms.uDensity.value = volumetrics.mediumDensity * 0.94;
        surfaceBeamB.material.uniforms.uAnisotropy.value = volumetrics.anisotropy;
        surfaceBeamB.material.uniforms.uTime.value = t + 3.1;
      }

      const secondaryAhead = Math.max(0, orbit.secondaryLocalDir.dot(surfaceForward));
      const secondaryRight = orbit.secondaryLocalDir.dot(surfaceRight);
      const secondaryReflection = secondaryAhead * surfaceResponse.secondaryTrailGain * (0.38 + surfaceResponse.glitterWidth * 0.84);
      if (secondaryReflection > 0.03) {
        surfaceReflectionB.visible = true;
        surfaceReflectionB.position.copy(camera.position)
          .add(surfaceForward.clone().multiplyScalar(64 + secondaryAhead * 28))
          .add(surfaceRight.clone().multiplyScalar(secondaryRight * 22));
        surfaceReflectionB.position.y = camera.position.y - 1.77;
        surfaceReflectionB.rotation.set(-Math.PI / 2, 0, -secondaryRight * 0.14);
        surfaceReflectionB.scale.set(
          0.34 + surfaceResponse.glitterWidth * 0.1,
          0.25 + surfaceResponse.glitterWidth * 0.18,
          1,
        );
        surfaceReflectionB.material.opacity = 0.0025 + secondaryReflection * 0.02;
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
    surfaceSky.material.uniforms.uMultiScatterColor.value.copy(skyResponse.multiScatterColor);
    surfaceSky.material.uniforms.uSunDirA.value.copy(orbit.primaryLocalDir);
    surfaceSky.material.uniforms.uSunDirB.value.copy(orbit.secondaryLocalDir);
    surfaceSky.material.uniforms.uDayStrength.value = transport.daylight;
    surfaceSky.material.uniforms.uTwilightStrength.value = transport.twilight;
    surfaceSky.material.uniforms.uNightStrength.value = transport.night;
    surfaceSky.material.uniforms.uHaze.value = transport.haze;
    surfaceSky.material.uniforms.uMultiScatterStrength.value = skyResponse.multiScatterStrength;
    surfaceSky.material.uniforms.uZenithOpticalDepth.value = skyResponse.zenithOpticalDepth;
    surfaceSky.material.uniforms.uHorizonOpticalDepth.value = skyResponse.horizonOpticalDepth;
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
    seasonDay: orbit.seasonDay,
    seasonPhase: orbit.seasonPhase,
    secondStrength: secondary.directIlluminanceLux / 100000,
    scene: activeSceneKey,
    time24: format24Hour(binaryDayHours),
    primaryAltitudeDeg: primary.altitudeDeg,
    secondaryAltitudeDeg: secondary.altitudeDeg,
    primaryDeclinationDeg: THREE.MathUtils.radToDeg(orbit.primaryDeclination),
    secondaryDeclinationDeg: THREE.MathUtils.radToDeg(orbit.secondaryDeclination),
    primaryPhaseFraction: orbit.phaseFractionA,
    secondaryPhaseFraction: orbit.phaseFractionB,
    combinedPhaseFraction: orbit.combinedPhaseFraction,
    reflectedLightFactor,
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
      primaryDeclinationDeg: THREE.MathUtils.radToDeg(orbit.primaryDeclination),
      secondaryDeclinationDeg: THREE.MathUtils.radToDeg(orbit.secondaryDeclination),
      viewerTurnYaw: orbit.viewerTurnYaw,
      spinYaw: orbit.spinYaw,
      viewerYaw: orbit.viewerYaw,
      orbitRadius: orbit.orbitRadius,
    },
    viewerInset: {
      latitudeDeg: observerLatitudeDeg,
      observerNormal: [orbit.observerNormal.x, orbit.observerNormal.y, orbit.observerNormal.z],
      viewerTangent: [orbit.viewerTangentWorld.x, orbit.viewerTangentWorld.y, orbit.viewerTangentWorld.z],
      primaryDir: [orbit.primaryDir.x, orbit.primaryDir.y, orbit.primaryDir.z],
      secondaryDir: [orbit.secondaryDir.x, orbit.secondaryDir.y, orbit.secondaryDir.z],
      spinAxis: [orbit.spinAxis.x, orbit.spinAxis.y, orbit.spinAxis.z],
      travelNorth: [orbit.travelNorth.x, orbit.travelNorth.y, orbit.travelNorth.z],
      viewerLightDot: orbit.viewerLightDot,
    },
    lighting: lightingDebugState(lighting),
    backgroundLuma: scene.background?.isColor
      ? Number(scene.background.getHSL({ h: 0, s: 0, l: 0 }).l.toFixed(4))
      : null,
    fogDensity: Number(scene.fog?.density?.toFixed?.(4) || 0),
  };
}
