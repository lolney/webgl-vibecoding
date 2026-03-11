import * as THREE from "three";

export const binaryDefaultStartHour = 6.0;
export const binaryDefaultSimulationDays = 85.35;
export const binaryTimeMultipliers = [1, 2, 4, 8, 16];

export const binaryPresets = [
  {
    key: "surface-sunrise",
    scene: "binarySurface",
    label: "Surface // Sunrise",
    state: {
      binaryDayHours: 6.0,
      simulationDays: 85.35,
      latitudeDeg: 0,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: false,
    },
  },
  {
    key: "surface-noon",
    scene: "binarySurface",
    label: "Surface // High Day",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 85.6,
      latitudeDeg: 28,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: true,
      surfacePitch: 0.98,
    },
  },
  {
    key: "surface-second-sun",
    scene: "binarySurface",
    label: "Surface // Second Sun Event",
    state: {
      binaryDayHours: 18.45,
      simulationDays: 100.0,
      latitudeDeg: 24,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: true,
      surfacePitch: 0.32,
    },
  },
  {
    key: "surface-sunset",
    scene: "binarySurface",
    label: "Surface // Sunset",
    state: {
      binaryDayHours: 18.0,
      simulationDays: 97.0,
      latitudeDeg: 0,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: true,
      surfacePitch: 0.3,
    },
  },
  {
    key: "surface-night",
    scene: "binarySurface",
    label: "Surface // Night",
    state: {
      binaryDayHours: 22.3,
      simulationDays: 86.58,
      latitudeDeg: 18,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: false,
    },
  },
  {
    key: "external-wide",
    scene: "binaryExternal",
    label: "External // Wide",
    state: {
      binaryDayHours: 6.0,
      simulationDays: 85.35,
      multiplier: 1,
      cinematic: false,
      orbitView: { azimuth: 0.88, polar: 1.18, distance: 34, targetX: 0, targetY: 0, targetZ: 0 },
    },
  },
  {
    key: "external-conjunction",
    scene: "binaryExternal",
    label: "External // Conjunction",
    state: {
      binaryDayHours: 18.65,
      simulationDays: 86.42,
      multiplier: 1,
      cinematic: true,
      orbitView: { azimuth: 2.2, polar: 1.0, distance: 28, targetX: 0, targetY: 0, targetZ: 0 },
    },
  },
];

export function getPresetsForScene(sceneKey) {
  return binaryPresets.filter((preset) => preset.scene === sceneKey);
}

export function findBinaryPreset(presetKey) {
  return binaryPresets.find((preset) => preset.key === presetKey) || null;
}

export function readNumberParam(query, key) {
  const raw = query.get(key);
  if (raw === null || raw === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readBinaryUrlState(query) {
  return {
    scene: query.get("scene"),
    preset: query.get("preset"),
    binaryHour: readNumberParam(query, "binaryHour"),
    binaryHourRate: readNumberParam(query, "binaryHourRate"),
    binaryLat: readNumberParam(query, "binaryLat"),
    binaryLon: readNumberParam(query, "binaryLon"),
    timeMultiplier: readNumberParam(query, "timeMultiplier"),
    cinematic: query.get("cinematic") === "1",
    diagnostics: query.get("diagnostics") === "1",
  };
}

export function resolveInitialBinaryState(urlState) {
  const preset = findBinaryPreset(urlState.preset);
  const presetState = preset?.state || {};
  const rawHour = urlState.binaryHour ?? presetState.binaryDayHours ?? binaryDefaultStartHour;
  const binaryDayHours = THREE.MathUtils.euclideanModulo(rawHour, 24);
  return {
    presetKey: preset?.key || "",
    binaryDayHours,
    binarySimulationDays: Number.isFinite(urlState.binaryHour)
      ? binaryDefaultSimulationDays + ((urlState.binaryHour - binaryDefaultStartHour) / 24)
      : (presetState.simulationDays ?? binaryDefaultSimulationDays),
    binaryHourRateBase: urlState.binaryHourRate ?? 0.12,
    binaryTimeMultiplier: coerceTimeMultiplier(urlState.timeMultiplier ?? presetState.multiplier ?? 1),
    observerLatitudeDeg: urlState.binaryLat ?? presetState.latitudeDeg ?? 0,
    observerLongitudeDeg: urlState.binaryLon ?? presetState.longitudeDeg ?? 0,
    cinematic: urlState.cinematic || Boolean(presetState.cinematic),
    diagnosticsVisible: urlState.diagnostics,
    scene: urlState.scene || preset?.scene || "clocktower",
    orbitView: presetState.orbitView || null,
  };
}

export function coerceTimeMultiplier(mult) {
  let nextMultiplier = binaryTimeMultipliers[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of binaryTimeMultipliers) {
    const distance = Math.abs(candidate - (Number.isFinite(mult) ? mult : binaryTimeMultipliers[0]));
    if (distance < bestDistance) {
      bestDistance = distance;
      nextMultiplier = candidate;
    }
  }
  return nextMultiplier;
}

export function buildUrlFromState(url, state) {
  const next = new URL(url.toString());
  const { searchParams } = next;
  const formatMaybeNumber = (value, digits = 2) => (Number.isFinite(value) ? value.toFixed(digits) : null);
  const setMaybe = (key, value, shouldKeep = true) => {
    if (!shouldKeep || value === null || value === undefined || value === "") {
      searchParams.delete(key);
      return;
    }
    searchParams.set(key, String(value));
  };

  setMaybe("scene", state.scene, state.scene && state.scene !== "clocktower");
  setMaybe("preset", state.preset, Boolean(state.preset));
  setMaybe("binaryHour", formatMaybeNumber(state.binaryHour, 2), state.scene !== "clocktower");
  setMaybe("binaryLat", formatMaybeNumber(state.binaryLat, 2), state.scene === "binarySurface");
  setMaybe("binaryLon", formatMaybeNumber(state.binaryLon, 2), state.scene === "binarySurface");
  setMaybe("binaryHourRate", formatMaybeNumber(state.binaryHourRate, 3), state.binaryHourRate !== 0.12);
  setMaybe("timeMultiplier", state.timeMultiplier, state.scene === "binarySurface" && state.timeMultiplier !== 1);
  setMaybe("cinematic", state.cinematic ? 1 : null, Boolean(state.cinematic));
  setMaybe("diagnostics", state.diagnostics ? 1 : null, Boolean(state.diagnostics));
  return next;
}
