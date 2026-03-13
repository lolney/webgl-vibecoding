import { isBinaryExternalScene, isBinarySurfaceScene } from "../shared/sceneFamilies.js";

export function applySceneModeInternal(params) {
  const {
    nextSceneKey,
    options = {},
    sceneManager,
    sceneByKey,
    clocktowerScene,
    clocktowerObjects,
    binaryObjects,
    surfacePovGroup,
    surfaceForeground,
    controls,
    camera,
    clocktowerAmbient,
    binaryAmbient,
    binaryStarALight,
    binaryStarBLight,
    binaryFill,
    key,
    rim,
    beamLight,
    moon,
    planetMesh,
    cloudLayer,
    hud,
    timeIndicator,
    syncSceneToUrl,
    setCinematic,
  } = params;

  const { syncUrl = true, pushHistory = false } = options;
  const activeSceneKey = sceneManager.has(nextSceneKey) ? nextSceneKey : "clocktower";
  sceneManager.setActive(activeSceneKey);
  const activeSceneDef = sceneByKey[activeSceneKey] || clocktowerScene;
  const isClocktower = activeSceneKey === "clocktower";
  const isExternalFamily = isBinaryExternalScene(activeSceneKey);

  for (const obj of clocktowerObjects) obj.visible = isClocktower;
  for (const obj of binaryObjects) obj.visible = isExternalFamily;
  surfacePovGroup.visible = isBinarySurfaceScene(activeSceneKey);
  surfaceForeground.visible = false;
  const preset = activeSceneDef.controls || clocktowerScene.controls;
  controls.minDistance = preset.minDistance;
  controls.maxDistance = preset.maxDistance;
  controls.minPolarAngle = preset.minPolarAngle;
  controls.maxPolarAngle = preset.maxPolarAngle;
  controls.minAzimuthAngle = Number.isFinite(preset.minAzimuthAngle) ? preset.minAzimuthAngle : -Infinity;
  controls.maxAzimuthAngle = Number.isFinite(preset.maxAzimuthAngle) ? preset.maxAzimuthAngle : Infinity;
  controls.enablePan = preset.enablePan;

  binaryStarALight.visible = !isClocktower;
  binaryStarBLight.visible = !isClocktower;
  binaryAmbient.visible = !isClocktower;
  binaryFill.visible = !isClocktower;

  clocktowerAmbient.visible = isClocktower;
  key.visible = isClocktower;
  rim.visible = isClocktower;
  beamLight.visible = isClocktower;
  moon.visible = isClocktower;

  if (isClocktower) {
    camera.up.set(0, 1, 0);
    if (window.innerHeight > window.innerWidth) {
      camera.position.set(0, 3.05, 27.5);
      controls.target.set(0, 2.05, 0);
    } else {
      camera.position.set(0, 3.2, 18.0);
      controls.target.set(0, 2.2, 0);
    }
    planetMesh.visible = true;
    cloudLayer.visible = true;
    if (timeIndicator) timeIndicator.textContent = activeSceneDef.timeBadge || "Time --:--";
    hud.setScene("clocktower");
  } else if (isExternalFamily) {
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    camera.position.set(26.0, 11.0, 24.0);
    planetMesh.visible = true;
    cloudLayer.visible = true;
    hud.setScene(activeSceneKey);
  } else if (isBinarySurfaceScene(activeSceneKey)) {
    controls.target.set(0, 4.15, -53.92);
    planetMesh.visible = false;
    cloudLayer.visible = false;
    camera.up.set(0, 1, 0);
    camera.position.set(0, 1.278, -66.8);
    hud.setScene(activeSceneKey);
  }
  controls.update();
  if (syncUrl) syncSceneToUrl(activeSceneKey, { pushHistory });
  return activeSceneKey;
}
