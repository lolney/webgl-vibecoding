const BINARY_SURFACE_SCENES = new Set(["binarySurface", "binaryTwilightSurface"]);
const BINARY_EXTERNAL_SCENES = new Set(["binaryExternal", "eclipseScene"]);
const BINARY_SCENES = new Set([...BINARY_SURFACE_SCENES, ...BINARY_EXTERNAL_SCENES]);

export function isBinaryScene(sceneKey) {
  return BINARY_SCENES.has(sceneKey);
}

export function isBinarySurfaceScene(sceneKey) {
  return BINARY_SURFACE_SCENES.has(sceneKey);
}

export function isBinaryExternalScene(sceneKey) {
  return BINARY_EXTERNAL_SCENES.has(sceneKey);
}
