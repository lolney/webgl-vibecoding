export function createDiagnosticsPanel({ root = document } = {}) {
  const panel = root.getElementById("diagnosticsPanel");

  function setVisible(visible) {
    if (!panel) return;
    panel.classList.toggle("hidden", !visible);
  }

  function render(lines) {
    if (!panel) return;
    panel.textContent = Array.isArray(lines) ? lines.join("\n") : "";
  }

  return {
    setVisible,
    render,
  };
}
