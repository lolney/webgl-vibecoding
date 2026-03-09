export function createSceneManager({ sceneDefs, onSceneChanged }) {
  const byKey = Object.fromEntries(sceneDefs.map((d) => [d.key, d]));
  let activeKey = sceneDefs[0]?.key || "";

  function has(sceneKey) {
    return !!byKey[sceneKey];
  }

  function setActive(sceneKey, options = {}) {
    const nextKey = has(sceneKey) ? sceneKey : activeKey;
    if (!nextKey || nextKey === activeKey) return activeKey;
    const prev = activeKey;
    activeKey = nextKey;
    if (onSceneChanged) onSceneChanged({ prev, next: nextKey, options, sceneDef: byKey[nextKey] });
    return activeKey;
  }

  return {
    has,
    setActive,
    getActiveKey: () => activeKey,
    getActiveDef: () => byKey[activeKey],
    getByKey: (sceneKey) => byKey[sceneKey],
    getAll: () => sceneDefs,
  };
}
