export function createHudPrimitive({ root = document } = {}) {
  const sceneChooser = root.getElementById("sceneChooser");
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

  return {
    elements: { sceneChooser, modeBadge, timeIndicator, timeRateButton, title },
    setSceneOptions,
    setScene(sceneKey) {
      if (sceneChooser) sceneChooser.value = sceneKey;
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
