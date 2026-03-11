export function createHudPrimitive({ root = document } = {}) {
  const sceneChooser = root.getElementById("sceneChooser");
  const presetChooser = root.getElementById("presetChooser");
  const modeBadge = root.getElementById("modeBadge");
  const timeIndicator = root.getElementById("timeIndicator");
  const timeRateButton = root.getElementById("timeRateButton");
  const title = root.querySelector(".hud h1");

  function setSceneOptions(sceneDefs) {
    if (!sceneChooser) return;
    sceneChooser.innerHTML = "";
    for (const sceneDef of sceneDefs) {
      const option = document.createElement("option");
      option.value = sceneDef.key;
      option.textContent = sceneDef.menuLabel || sceneDef.label;
      sceneChooser.appendChild(option);
    }
  }

  function setPresetOptions(presets) {
    if (!presetChooser) return;
    presetChooser.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Preset";
    presetChooser.appendChild(placeholder);
    for (const preset of presets) {
      const option = document.createElement("option");
      option.value = preset.key;
      option.textContent = preset.label;
      presetChooser.appendChild(option);
    }
  }

  return {
    elements: { sceneChooser, presetChooser, modeBadge, timeIndicator, timeRateButton, title },
    setSceneOptions,
    setPresetOptions,
    setScene(sceneKey) {
      if (sceneChooser) sceneChooser.value = sceneKey;
    },
    setPreset(presetKey) {
      if (presetChooser) presetChooser.value = presetKey || "";
    },
    setModeText(text) {
      if (modeBadge) modeBadge.textContent = text;
    },
    setTimeText(text) {
      if (timeIndicator) timeIndicator.textContent = text;
    },
    setTimeRateText(text) {
      if (timeRateButton) timeRateButton.textContent = text;
    },
    setTitle(text) {
      if (title && text) title.textContent = text;
    },
  };
}
