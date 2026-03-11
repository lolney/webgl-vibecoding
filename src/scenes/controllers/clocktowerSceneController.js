import * as THREE from "three";
import { clocktowerLightModel } from "../shared/lightModel.js";

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
    moonHalo,
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

  const autoAngle = t * 0.19;
  renderer.toneMappingExposure = 0.62;
  clocktowerAmbient.intensity = clocktowerLightModel.ambient.intensity;
  clocktowerAmbient.color.setHex(clocktowerLightModel.ambient.color);
  scene.background.setHex(0x02030f);
  scene.fog.color.setHex(0x02030f);
  scene.fog.density = 0.065;
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

  const pulse = 0.45 + level * 0.85 + beat * 1.2;
  const sectionBoost = section === 1
    ? clocktowerLightModel.sectionBoost.sectionOne
    : section === 3
      ? clocktowerLightModel.sectionBoost.sectionThree
      : clocktowerLightModel.sectionBoost.default;
  beamLight.intensity = (
    clocktowerLightModel.beam.baseIntensity
    + pulse * clocktowerLightModel.beam.pulseGain
  ) * sectionBoost;
  rim.intensity = (
    clocktowerLightModel.rim.baseIntensity
    + Math.sin(t * 2.3) * clocktowerLightModel.rim.swingIntensity
    + pulse * clocktowerLightModel.rim.pulseGain
  ) * sectionBoost;
  key.intensity = clocktowerLightModel.key.baseIntensity
    + Math.sin(t * 1.25) * clocktowerLightModel.key.swingIntensity
    + level * clocktowerLightModel.key.levelGain
    + (section === 2 ? clocktowerLightModel.key.sectionTwoBoost : 0);
  moon.intensity = clocktowerLightModel.moon.baseIntensity
    + Math.sin(t * 0.4) * clocktowerLightModel.moon.swingIntensity
    + level * clocktowerLightModel.moon.levelGain;
  beamLight.distance = clocktowerLightModel.beam.baseDistance + level * clocktowerLightModel.beam.levelDistanceGain;

  moonVisual.position.set(
    moonBase.x + Math.sin(t * 0.08) * 1.3,
    moonBase.y + Math.sin(t * 0.06) * 0.5,
    moonBase.z + Math.cos(t * 0.07) * 1.2,
  );
  moon.position.copy(moonVisual.position).normalize().multiplyScalar(28);
  moonDir.copy(moon.position).normalize();
  moonVisual.lookAt(camera.position);
  moonHalo.material.uniforms.uPulse.value = 0.2 + level * 0.35 + beat * 0.55;

  moonReflection.position.x = THREE.MathUtils.clamp(moonVisual.position.x * 0.5, -18.0, -12.0);
  moonReflection.position.z = shorelineZ - 20.0 + Math.max(-5, moonVisual.position.z + 36.0) * 0.12;
  moonReflection.scale.x = 0.9 + Math.abs(moonDir.x) * 0.7;
  moonReflection.material.uniforms.uTime.value = t;
  moonReflection.material.uniforms.uBeat.value = Math.min(1.0, level * 0.7 + beat * 0.8);
  moonReflection.material.uniforms.uStrength.value = 1.55 + moon.intensity * clocktowerLightModel.moon.reflectionGainPrimary;

  moonReflectionWide.position.x = moonReflection.position.x + 1.1;
  moonReflectionWide.position.z = moonReflection.position.z - 5.2;
  moonReflectionWide.material.uniforms.uTime.value = t * 0.85 + 4.0;
  moonReflectionWide.material.uniforms.uBeat.value = Math.min(1.0, level * 0.55 + beat * 0.6);
  moonReflectionWide.material.uniforms.uStrength.value = 1.0 + moon.intensity * clocktowerLightModel.moon.reflectionGainWide;

  beaconBeam.rotation.z = Math.sin(t * 1.5) * 0.16 + beat * 0.06;
  beaconBeam.material.opacity = 0.11 + (Math.sin(t * 3.6) * 0.5 + 0.5) * 0.13 + level * 0.18;
  displaceWaterGeometry(oceanGeometry, oceanBasePos, t * 0.9, 1.15 + level * 0.3 + beat * 0.45);
  displaceWaterGeometry(farOceanGeometry, farOceanBasePos, t * 0.72 + 5.0, 0.95 + level * 0.2);

  ocean.material.uniforms.time.value = t * 0.48;
  ocean.material.uniforms.sunDirection.value.copy(key.position).normalize();
  ocean.material.uniforms.distortionScale.value = 3.2 + level * 1.5 + beat * 2.1;
  ocean.position.x = Math.sin(t * 0.05) * 2.0;
  ocean.rotation.z = Math.sin(t * 0.04) * 0.004;
  farOcean.material.uniforms.time.value = t * 0.36 + 12.0;
  farOcean.material.uniforms.sunDirection.value.copy(key.position).normalize();
  farOcean.material.uniforms.distortionScale.value = 4.4 + level * 1.2;

  stars.rotation.y = t * 0.01;
  sky.rotation.y = -t * 0.006;

  strobeRig.rotation.y = t * 0.09;
  for (let i = 0; i < strobeSpots.length; i += 1) {
    const spot = strobeSpots[i];
    const target = strobeTargets[i];
    const cone = strobeCones[i];
    const phase = t * (8.5 + i * 0.75) + i * 1.13;
    const hardStrobe = Math.pow(Math.max(0, Math.sin(phase)), section === 3 ? 7.5 : 5.8);
    const beatAmp = 1.0 + beat * 2.2;
    const base = clocktowerLightModel.strobe.baseIntensity;
    const peak = (
      section === 3
        ? clocktowerLightModel.strobe.sectionThreePeak
        : clocktowerLightModel.strobe.sectionDefaultPeak
    ) * beatAmp;
    spot.intensity = base + hardStrobe * peak;
    spot.angle = 0.16 + (Math.sin(t * 0.7 + i) * 0.5 + 0.5) * 0.14;

    target.position.set(
      Math.sin(t * 0.48 + i * 1.4) * 1.8,
      1.3 + Math.sin(t * 0.7 + i * 0.8) * 0.55,
      Math.cos(t * 0.52 + i * 1.1) * 1.5,
    );

    cone.position.copy(spot.position);
    tmpDir.copy(target.position).sub(spot.position).normalize();
    cone.quaternion.setFromUnitVectors(upAxis, tmpDir);
    cone.material.opacity = 0.008 + hardStrobe * (0.045 + level * 0.06);
    cone.scale.set(1, 1 + level * 0.12, 1);
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

  bloomPass.strength =
    (section === 3 ? 0.78 : 0.48) + level * (section === 1 ? 0.34 : 0.24) + beat * 0.22;
  bloomPass.radius = 0.28 + level * (section === 2 ? 0.18 : 0.12);
  bloomPass.threshold = (section === 3 ? 0.84 : 0.88) - level * 0.03;

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
  };
}
