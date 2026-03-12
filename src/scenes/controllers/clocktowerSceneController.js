import * as THREE from "three";
import { clocktowerLightModel } from "../shared/lightModel.js";
import {
  computeClocktowerLightingState,
  computeClocktowerMoonState,
  clocktowerLightingDebugState,
} from "../shared/clocktowerLighting.js";

export function updateClocktowerScene(ctx, frame) {
  const {
    camera,
    controls,
    renderer,
    scene,
    composer,
    stars,
    sky,
    clocktowerAmbient,
    key,
    rim,
    moon,
    moonVisual,
    moonDisk,
    moonHalo,
    moonShaft,
    moonReflection,
    moonReflectionWide,
    moonDir,
    moonBase,
    shorelineZ,
    beamLight,
    beaconBeam,
    ocean,
    oceanGeometry,
    oceanBasePos,
    farOcean,
    farOceanGeometry,
    farOceanBasePos,
    strobeRig,
    strobeSpots,
    strobeTargets,
    strobeCones,
    ringGroup,
    city,
    cityCount,
    cityData,
    tmpColor,
    tmpDir,
    upAxis,
    bloomPieces,
    ground,
    shoreline,
    bloomPass,
    crtPass,
    sectionNames,
    usingBlenderTower,
    usingBlenderCity,
    blenderTowerRoot,
    towerGroup,
    minuteHand,
    hourHand,
    blenderMinuteHand,
    blenderHourHand,
    debugView,
    displaceWaterGeometry,
  } = ctx;

  const { t, beat, level, section, cinematicMix } = frame;
  const lighting = computeClocktowerLightingState({
    t,
    beat,
    level,
    section,
    strobeCount: strobeSpots.length,
  });

  const autoAngle = t * 0.19;
  renderer.toneMappingExposure = lighting.display.exposure;
  clocktowerAmbient.intensity = lighting.ambient.intensity;
  clocktowerAmbient.color.setHex(clocktowerLightModel.ambient.color);
  scene.background.setHex(0x02030f);
  scene.fog.color.setHex(0x02030f);
  scene.fog.density = lighting.ambient.fogDensity;
  stars.material.opacity = 0.86;
  const autoRadius = 7.2 + Math.sin(t * 0.37) * 1.4;
  const autoPos = new THREE.Vector3(
    Math.cos(autoAngle) * autoRadius,
    2.6 + Math.sin(t * 0.24) * 1.1,
    Math.sin(autoAngle) * autoRadius,
  );

  camera.position.lerp(autoPos, cinematicMix * 0.04);
  controls.target.lerp(new THREE.Vector3(0, 1.45 + Math.sin(t * 0.9) * 0.12, 0), cinematicMix * 0.04);

  const activeTower = usingBlenderTower ? blenderTowerRoot : towerGroup;
  activeTower.rotation.y = Math.sin(t * 0.25) * 0.08 + beat * 0.1;
  activeTower.position.y = Math.sin(t * 0.9) * 0.035 + beat * 0.05;

  if (!usingBlenderTower) {
    minuteHand.rotation.z = -t * 1.85;
    hourHand.rotation.z = -t * 0.39;
  } else {
    if (blenderMinuteHand) blenderMinuteHand.rotation.y = -t * 1.85;
    if (blenderHourHand) blenderHourHand.rotation.y = -t * 0.39;
  }

  beamLight.intensity = lighting.beam.intensity;
  beamLight.distance = lighting.beam.distance;
  beamLight.angle = lighting.beam.angle;
  beamLight.penumbra = lighting.beam.penumbra;
  rim.intensity = lighting.rim.intensity;
  key.intensity = lighting.key.intensity;
  moon.intensity = lighting.moon.intensity;

  moonVisual.position.set(
    moonBase.x + Math.sin(t * 0.08) * 1.3,
    moonBase.y + Math.sin(t * 0.06) * 0.5,
    moonBase.z + Math.cos(t * 0.07) * 1.2,
  );
  const moonState = computeClocktowerMoonState({
    moonPosition: moonVisual.position,
    cameraPosition: camera.position,
    waterHeight: moonReflection.position.y,
  });
  moon.position.copy(moonVisual.position).normalize().multiplyScalar(28);
  moonDir.copy(moon.position).normalize();
  moonVisual.lookAt(camera.position);
  moon.color.copy(moonState.discColor);
  moon.intensity *= 0.62 + moonState.transmittanceLuma * 0.38;
  moonDisk.material.color.copy(moonState.discColor);
  moonDisk.material.opacity = moonState.discOpacity;
  moonDisk.scale.setScalar(moonState.discScale);
  moonHalo.material.uniforms.uPulse.value = lighting.moon.haloPulse * moonState.haloPulse;
  moonHalo.scale.setScalar(moonState.haloScale);

  moonShaft.visible = lighting.moon.shaftStrength * moonState.reflectionStrength > 0.02;
  if (moonShaft.visible) {
    const shaftTarget = moonState.reflectionCenter.clone().add(new THREE.Vector3(0, 1.5, 0));
    const shaftDir = shaftTarget.clone().sub(moonVisual.position);
    const shaftLen = shaftDir.length();
    shaftDir.normalize();
    moonShaft.position.copy(moonVisual.position).add(shaftDir.clone().multiplyScalar(shaftLen * 0.48));
    moonShaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), shaftDir);
    const shaftRadius = THREE.MathUtils.lerp(1.2, 2.8, lighting.moon.shaftStrength);
    moonShaft.scale.set(shaftRadius, shaftLen, shaftRadius);
    moonShaft.material.uniforms.uColor.value.copy(moonState.discColor);
    moonShaft.material.uniforms.uStrength.value = lighting.moon.shaftStrength * moonState.reflectionStrength * 0.75;
    moonShaft.material.uniforms.uDensity.value = lighting.beam.mediumDensity * 0.78;
    moonShaft.material.uniforms.uAnisotropy.value = 0.58;
    moonShaft.material.uniforms.uTime.value = t * 0.5;
  }

  moonReflection.position.copy(moonState.reflectionCenter);
  moonReflection.position.z = Math.min(moonReflection.position.z, shorelineZ - 2.4);
  moonReflection.scale.set(
    moonState.reflectionPrimaryScale.x,
    moonState.reflectionPrimaryScale.y,
    1.0,
  );
  moonReflection.material.uniforms.uTime.value = t;
  moonReflection.material.uniforms.uBeat.value = Math.min(1.0, level * 0.7 + beat * 0.8);
  moonReflection.material.uniforms.uStrength.value = lighting.moon.reflectionPrimary * moonState.reflectionStrength * 1.35;

  moonReflectionWide.position.copy(moonReflection.position).add(new THREE.Vector3(0.9, -0.001, -4.8));
  moonReflectionWide.scale.set(
    moonState.reflectionWideScale.x,
    moonState.reflectionWideScale.y,
    1.0,
  );
  moonReflectionWide.material.uniforms.uTime.value = t * 0.85 + 4.0;
  moonReflectionWide.material.uniforms.uBeat.value = Math.min(1.0, level * 0.55 + beat * 0.6);
  moonReflectionWide.material.uniforms.uStrength.value = lighting.moon.reflectionWide * moonState.reflectionStrength;

  beaconBeam.rotation.z = lighting.beam.sweep;
  beaconBeam.position.y = 12.8 + lighting.beam.distance * 0.48;
  beaconBeam.scale.set(
    THREE.MathUtils.clamp(lighting.beam.radius * 0.22, 0.65, 2.4),
    lighting.beam.distance,
    THREE.MathUtils.clamp(lighting.beam.radius * 0.22, 0.65, 2.4),
  );
  beaconBeam.material.uniforms.uColor.value.setHex(0x59ddff);
  beaconBeam.material.uniforms.uStrength.value = lighting.beam.coneOpacity * 0.3;
  beaconBeam.material.uniforms.uDensity.value = lighting.beam.mediumDensity;
  beaconBeam.material.uniforms.uAnisotropy.value = 0.72;
  beaconBeam.material.uniforms.uTime.value = t;
  displaceWaterGeometry(oceanGeometry, oceanBasePos, t * 0.9, 1.15 + level * 0.3 + beat * 0.45);
  displaceWaterGeometry(farOceanGeometry, farOceanBasePos, t * 0.72 + 5.0, 0.95 + level * 0.2);

  ocean.material.uniforms.time.value = t * 0.48;
  ocean.material.uniforms.sunDirection.value.copy(moonDir);
  ocean.material.uniforms.distortionScale.value = 3.2 + level * 1.5 + beat * 2.1;
  ocean.position.x = Math.sin(t * 0.05) * 2.0;
  ocean.rotation.z = Math.sin(t * 0.04) * 0.004;
  farOcean.material.uniforms.time.value = t * 0.36 + 12.0;
  farOcean.material.uniforms.sunDirection.value.copy(moonDir);
  farOcean.material.uniforms.distortionScale.value = 4.4 + level * 1.2;

  stars.rotation.y = t * 0.01;
  sky.rotation.y = -t * 0.006;

  strobeRig.rotation.y = t * 0.09;
  for (let i = 0; i < strobeSpots.length; i += 1) {
    const spot = strobeSpots[i];
    const target = strobeTargets[i];
    const cone = strobeCones[i];
    const strobe = lighting.strobes[i];
    spot.angle = strobe.angle;
    spot.distance = strobe.distance;

    target.position.set(strobe.target.x, strobe.target.y, strobe.target.z);

    cone.position.copy(spot.position);
    tmpDir.copy(target.position).sub(spot.position).normalize();
    cone.quaternion.setFromUnitVectors(upAxis, tmpDir);
    const cameraToSpot = camera.position.clone().sub(spot.position).normalize();
    const viewAlignment = Math.abs(tmpDir.dot(cameraToSpot));
    const spotFacingFade = 1 - THREE.MathUtils.smoothstep(viewAlignment, 0.7, 0.94);
    spot.intensity = (strobe.gate > 0.12 ? strobe.intensity : 0) * spotFacingFade;
    const viewFade = Math.pow(1 - THREE.MathUtils.smoothstep(viewAlignment, 0.26, 0.72), 1.35);
    const cameraOffset = camera.position.clone().sub(spot.position);
    const axisProjection = THREE.MathUtils.clamp(cameraOffset.dot(tmpDir), 0, strobe.distance);
    const closestPoint = spot.position.clone().add(tmpDir.clone().multiplyScalar(axisProjection));
    const radialDistance = closestPoint.distanceTo(camera.position);
    const coneRadiusAtCamera = Math.max(0.22, Math.tan(strobe.angle) * axisProjection);
    const insideFade = THREE.MathUtils.smoothstep(radialDistance / coneRadiusAtCamera, 0.72, 1.08);
    const sectionConeScale = section === 3 ? 0.22 : 0.0;
    const coneStrength = strobe.coneOpacity * viewFade * insideFade * sectionConeScale;
    cone.visible = section === 3 && coneStrength > 0.002;
    const coneRadius = THREE.MathUtils.clamp(strobe.distance * Math.tan(strobe.angle) * 0.065, 0.24, 0.82);
    cone.position.copy(spot.position).add(tmpDir.clone().multiplyScalar(strobe.distance * 0.5));
    cone.scale.set(coneRadius, strobe.distance * strobe.coneStretch, coneRadius);
    cone.material.uniforms.uColor.value.copy(spot.color);
    cone.material.uniforms.uStrength.value = coneStrength * 0.032;
    cone.material.uniforms.uDensity.value = strobe.mediumDensity;
    cone.material.uniforms.uAnisotropy.value = 0.68;
    cone.material.uniforms.uTime.value = t + i * 0.7;
  }

  ringGroup.children.forEach((ring, i) => {
    ring.rotation.z = t * (0.2 + i * 0.08) * (i % 2 === 0 ? 1 : -1);
    ring.material.opacity = 0.18 + (Math.sin(t * 1.9 + i * 1.2) * 0.5 + 0.5) * 0.2 + level * 0.18;
    ring.scale.setScalar(1 + beat * (0.08 + i * 0.03));
  });

  for (let i = 0; i < cityCount; i += 1) {
    const c = cityData[i];
    const hue = 0.56 + Math.sin(t * 0.6 + c.phase) * 0.04;
    const lit = 0.35 + (Math.sin(t * 1.8 * c.amp + c.phase) * 0.5 + 0.5) * 0.4 + level * 0.3;
    tmpColor.setHSL(hue, 0.72, lit);
    city.setColorAt(i, tmpColor);
  }
  city.instanceColor.needsUpdate = true;

  for (let i = 0; i < bloomPieces.length; i += 1) {
    const mat = bloomPieces[i];
    if (mat && "emissiveIntensity" in mat) {
      mat.emissiveIntensity = 0.15 + (Math.sin(t * 2.5 + i * 0.7) * 0.5 + 0.5) * 0.55 + level * 0.35;
    }
  }

  ground.material.uniforms.uTime.value = t;
  ground.material.uniforms.uBeat.value = Math.min(1.0, level * 0.8 + beat * 1.2);
  shoreline.material.uniforms.uTime.value = t;
  shoreline.material.uniforms.uBeat.value = Math.min(1.0, level * 0.8 + beat * 1.2);

  bloomPass.strength = lighting.display.bloomStrength;
  bloomPass.radius = lighting.display.bloomRadius;
  bloomPass.threshold = lighting.display.bloomThreshold;

  crtPass.uniforms.uTime.value = t;
  crtPass.uniforms.uBeat.value = Math.min(1.0, beat * 1.2 + level * 0.6);
  crtPass.uniforms.uGlitch.value = Math.min(
    1.0,
    (section === 3 ? 0.65 : section === 1 ? 0.35 : 0.15) + beat * 0.7,
  );

  if (debugView) {
    renderer.render(scene, camera);
  } else {
    composer.render();
  }

  return {
    scene: "clocktower",
    section,
    oceanTime: Number(ocean.material.uniforms.time.value.toFixed(2)),
    lighting: {
      ...clocktowerLightingDebugState(lighting),
      moonAltitudeDeg: Number(moonState.altitudeDeg.toFixed(3)),
      moonAirMass: Number(moonState.airMass.toFixed(3)),
      moonReflectionStrength: Number(moonState.reflectionStrength.toFixed(4)),
    },
  };
}
