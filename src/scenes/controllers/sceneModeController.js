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

  for (const obj of clocktowerObjects) obj.visible = isClocktower;
  const isBinaryExternal = activeSceneKey === "binaryExternal";
  for (const obj of binaryObjects) obj.visible = isBinaryExternal;
  surfacePovGroup.visible = activeSceneKey === "binarySurface";
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
  binaryFill.visible = !isClocktower;

  key.visible = isClocktower;
  rim.visible = isClocktower;
  beamLight.visible = isClocktower;
  moon.visible = isClocktower;

  if (isClocktower) {
    camera.up.set(0, 1, 0);
    controls.target.set(0, 2.2, 0);
    planetMesh.visible = true;
    cloudLayer.visible = true;
    if (timeIndicator) timeIndicator.textContent = activeSceneDef.timeBadge || "Time --:--";
    hud.setScene("clocktower");
  } else if (activeSceneKey === "binaryExternal") {
    camera.up.set(0, 1, 0);
    controls.target.set(0, 0, 0);
    camera.position.set(26.0, 11.0, 24.0);
    planetMesh.visible = true;
    cloudLayer.visible = true;
    hud.setScene("binaryExternal");
  } else {
    controls.target.set(0, 1.2, -80);
    planetMesh.visible = false;
    cloudLayer.visible = false;
    camera.up.set(0, 1, 0);
    camera.position.set(0, 1.75, 13.0);
    hud.setScene("binarySurface");
  }
  controls.update();
  setCinematic(false);
  if (syncUrl) syncSceneToUrl(activeSceneKey, { pushHistory });
  return activeSceneKey;
}
