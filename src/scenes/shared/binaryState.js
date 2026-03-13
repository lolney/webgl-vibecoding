import * as THREE from "three";

export const binaryDefaultStartHour = 6.0;
export const binaryDefaultSimulationDays = 85.35;
export const binaryDefaultStartupPresetKey = "relay-pre-sunset";
export const binaryTimeMultipliers = [1, 2, 4, 8, 16];
export const sceneDefaultPresetKeys = {
  binarySurface: "surface-sunrise",
  binaryTwilightSurface: "relay-pre-sunset",
  binaryExternal: "external-wide",
  eclipseScene: "eclipse-totality",
};

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
      cinematic: false,
      surfacePitch: 0.07,
    },
  },
  {
    key: "surface-summer-solstice",
    scene: "binarySurface",
    label: "Surface // Summer Solstice",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 135.5,
      latitudeDeg: 60,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: false,
      surfacePitch: 0.28,
    },
  },
  {
    key: "surface-equinox",
    scene: "binarySurface",
    label: "Surface // Equinox",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 90.5,
      latitudeDeg: 60,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: false,
      surfacePitch: 0.18,
    },
  },
  {
    key: "surface-winter-solstice",
    scene: "binarySurface",
    label: "Surface // Winter Solstice",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 24.5,
      latitudeDeg: 60,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: false,
      surfacePitch: 0.08,
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
      surfacePitch: -0.03,
    },
  },
  {
    key: "relay-pre-sunset",
    scene: "binaryTwilightSurface",
    label: "Relay // First Sunset",
    state: {
      binaryDayHours: 17.873648590260473,
      simulationDays: 64.39841311618123,
      latitudeDeg: 11.185253925370489,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: true,
      surfacePitch: 0.08,
    },
  },
  {
    key: "relay-second-rise",
    scene: "binaryTwilightSurface",
    label: "Relay // Second Rise",
    state: {
      binaryDayHours: 18.423648590260473,
      simulationDays: 64.4213297828479,
      latitudeDeg: 11.185253925370489,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: true,
      surfacePitch: 0.08,
    },
  },
  {
    key: "relay-afterglow",
    scene: "binaryTwilightSurface",
    label: "Relay // Afterglow",
    state: {
      binaryDayHours: 19.473648590260474,
      simulationDays: 64.4650797828479,
      latitudeDeg: 11.185253925370489,
      longitudeDeg: 0,
      multiplier: 1,
      cinematic: true,
      surfacePitch: 0.06,
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
    key: "external-crescent",
    scene: "binaryExternal",
    label: "External // Crescent",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 154.0,
      multiplier: 1,
      cinematic: false,
      orbitView: { azimuth: 2.79, polar: 1.35, distance: 30, targetX: 0, targetY: 0, targetZ: 0 },
    },
  },
  {
    key: "external-eclipse-ingress",
    scene: "binaryExternal",
    label: "External // Eclipse Ingress",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 4.5,
      multiplier: 1,
      cinematic: false,
      orbitView: { azimuth: 0.049, polar: 1.45, distance: 26, targetX: 0, targetY: 0, targetZ: 0 },
    },
  },
  {
    key: "external-eclipse-totality",
    scene: "binaryExternal",
    label: "External // Eclipse Totality",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 5.0,
      multiplier: 1,
      cinematic: false,
      orbitView: { azimuth: 0.049, polar: 1.45, distance: 26, targetX: 0, targetY: 0, targetZ: 0 },
    },
  },
  {
    key: "external-eclipse-egress",
    scene: "binaryExternal",
    label: "External // Eclipse Egress",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 5.5,
      multiplier: 1,
      cinematic: false,
      orbitView: { azimuth: 0.049, polar: 1.45, distance: 26, targetX: 0, targetY: 0, targetZ: 0 },
    },
  },
  {
    key: "eclipse-ingress",
    scene: "eclipseScene",
    label: "Eclipse // Ingress",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 4.5,
      multiplier: 1,
      cinematic: true,
      orbitView: { azimuth: 0.049, polar: 1.45, distance: 26, targetX: 0, targetY: 0, targetZ: 0 },
    },
  },
  {
    key: "eclipse-totality",
    scene: "eclipseScene",
    label: "Eclipse // Totality",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 5.0,
      multiplier: 1,
      cinematic: true,
      orbitView: { azimuth: 0.049, polar: 1.45, distance: 26, targetX: 0, targetY: 0, targetZ: 0 },
    },
  },
  {
    key: "eclipse-egress",
    scene: "eclipseScene",
    label: "Eclipse // Egress",
    state: {
      binaryDayHours: 12.0,
      simulationDays: 5.5,
      multiplier: 1,
      cinematic: true,
      orbitView: { azimuth: 0.049, polar: 1.45, distance: 26, targetX: 0, targetY: 0, targetZ: 0 },
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

export function normalizeObserverCoordinates(latitudeDeg = 0, longitudeDeg = 0) {
  let lat = Number.isFinite(latitudeDeg) ? latitudeDeg : 0;
  let lon = Number.isFinite(longitudeDeg) ? longitudeDeg : 0;

  while (lat > 90) {
    lat = 180 - lat;
    lon += 180;
  }
  while (lat < -90) {
    lat = -180 - lat;
    lon += 180;
  }

  lon = THREE.MathUtils.euclideanModulo(lon + 180, 360) - 180;

  if (Math.abs(lat) < 1e-6) lat = 0;
  if (Math.abs(lon) < 1e-6) lon = 0;

  return { latitudeDeg: lat, longitudeDeg: lon };
}

export function resolveInitialBinaryState(urlState) {
  const startupPreset = findBinaryPreset(binaryDefaultStartupPresetKey);
  const explicitPreset = findBinaryPreset(urlState.preset);
  const sceneDefaultPreset = findBinaryPreset(sceneDefaultPresetKeys[urlState.scene] || "");
  const fallbackPreset = explicitPreset || sceneDefaultPreset || ((!urlState.scene && !urlState.preset) ? startupPreset : null);
  const preset = explicitPreset || fallbackPreset;
  const presetState = preset?.state || {};
  const rawHour = urlState.binaryHour ?? presetState.binaryDayHours ?? binaryDefaultStartHour;
  const rawLatitudeInput = urlState.binaryLat ?? presetState.latitudeDeg ?? 0;
  const rawLongitudeInput = urlState.binaryLon ?? presetState.longitudeDeg ?? 0;
  const binaryDayHours = THREE.MathUtils.euclideanModulo(rawHour, 24);
  const observerCoords = normalizeObserverCoordinates(
    rawLatitudeInput,
    rawLongitudeInput,
  );
  return {
    presetKey: preset?.key || "",
    binaryDayHours,
    binarySimulationDays: Number.isFinite(urlState.binaryHour)
      ? binaryDefaultSimulationDays + ((urlState.binaryHour - binaryDefaultStartHour) / 24)
      : (presetState.simulationDays ?? binaryDefaultSimulationDays),
    binaryHourRateBase: urlState.binaryHourRate ?? 0.12,
    binaryTimeMultiplier: coerceTimeMultiplier(urlState.timeMultiplier ?? presetState.multiplier ?? 1),
    observerLatitudeInputDeg: rawLatitudeInput,
    observerLongitudeInputDeg: rawLongitudeInput,
    observerLatitudeDeg: observerCoords.latitudeDeg,
    observerLongitudeDeg: observerCoords.longitudeDeg,
    cinematic: urlState.cinematic || Boolean(presetState.cinematic),
    diagnosticsVisible: urlState.diagnostics,
    scene: urlState.scene || preset?.scene || startupPreset?.scene || "clocktower",
    orbitView: presetState.orbitView || null,
    surfacePitch: Number.isFinite(presetState.surfacePitch) ? presetState.surfacePitch : null,
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
