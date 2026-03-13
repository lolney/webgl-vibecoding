import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cases = [
  { preset: "relay-pre-sunset", name: "relay-pre-sunset" },
  { preset: "relay-second-rise", name: "relay-second-rise" },
  { preset: "relay-afterglow", name: "relay-afterglow" },
];

for (const entry of cases) {
  const result = spawnSync(
    "node",
    ["scripts/headless-render.mjs", "--scene=binaryTwilightSurface", `--preset=${entry.preset}`, "--hour-rate=0", `--name=${entry.name}`, "--wait-ms=1800"],
    { cwd: projectRoot, stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readDebug(name) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, "output", `${name}-debug.json`), "utf8")).debug;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const pre = readDebug("relay-pre-sunset");
const rise = readDebug("relay-second-rise");
const after = readDebug("relay-afterglow");

assert(pre.scene === "binaryTwilightSurface", "Relay pre-sunset should use binaryTwilightSurface");
assert(rise.scene === "binaryTwilightSurface", "Relay second rise should use binaryTwilightSurface");
assert(after.scene === "binaryTwilightSurface", "Relay afterglow should use binaryTwilightSurface");
assert(pre.binarySystemKey === "twilightRelayBinary", "Relay scene should use twilightRelayBinary");
assert(rise.binarySystemKey === "twilightRelayBinary", "Relay scene should preserve twilightRelayBinary at second rise");
assert(after.binarySystemKey === "twilightRelayBinary", "Relay scene should preserve twilightRelayBinary afterglow");
assert(pre.primaryAltitudeDeg > 0 && pre.primaryAltitudeDeg < 4.5, "Primary star should be just above the horizon before sunset");
assert(pre.secondaryAltitudeDeg < -4, "Secondary star should remain below the horizon before sunset");
assert(pre.lighting.primaryDiscVisibleFraction > 0.99, "Primary disc should be fully visible before sunset");
assert(pre.lighting.secondaryDiscVisibleFraction === 0, "Secondary disc should be fully below the horizon before sunset");
assert(rise.primaryAltitudeDeg < -1, "Primary star should be below the horizon during the relay rise");
assert(rise.secondaryAltitudeDeg > 2, "Secondary star should rise above the horizon during the relay beat");
assert(rise.lighting.primaryDiscVisibleFraction === 0, "Primary disc should be fully below the horizon during relay rise");
assert(rise.lighting.secondaryDiscVisibleFraction > 0.99, "Secondary disc should be fully visible during relay rise");
assert(after.primaryAltitudeDeg < -10, "Primary star should be well below the horizon after the relay");
assert(after.secondaryAltitudeDeg < -4, "Secondary star should set again after the relay beat");
assert(after.lighting.primaryDiscVisibleFraction === 0, "Primary disc should be fully below the horizon after relay");
assert(after.lighting.secondaryDiscVisibleFraction === 0, "Secondary disc should be fully below the horizon after relay");

console.log("Relay regression OK.");
console.log(JSON.stringify({
  pre: {
    primaryAltitudeDeg: pre.primaryAltitudeDeg,
    secondaryAltitudeDeg: pre.secondaryAltitudeDeg,
  },
  rise: {
    primaryAltitudeDeg: rise.primaryAltitudeDeg,
    secondaryAltitudeDeg: rise.secondaryAltitudeDeg,
  },
  after: {
    primaryAltitudeDeg: after.primaryAltitudeDeg,
    secondaryAltitudeDeg: after.secondaryAltitudeDeg,
  },
}, null, 2));
