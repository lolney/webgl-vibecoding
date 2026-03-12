import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cases = [
  ["--scene=clocktower", "--name=matrix-clocktower"],
  ["--scene=clocktower", "--section=1", "--beat=0.45", "--level=0.55", "--name=matrix-clocktower-hyper-lift"],
  ["--scene=clocktower", "--section=3", "--beat=0.92", "--level=0.88", "--name=matrix-clocktower-strobe-core"],
  ["--scene=binaryExternal", "--preset=external-wide", "--name=matrix-external-wide"],
  ["--scene=binaryExternal", "--preset=external-crescent", "--name=matrix-external-crescent"],
  ["--scene=binaryExternal", "--preset=external-eclipse-ingress", "--name=matrix-external-eclipse-ingress"],
  ["--scene=binaryExternal", "--preset=external-eclipse-totality", "--name=matrix-external-eclipse-totality"],
  ["--scene=binaryExternal", "--preset=external-eclipse-egress", "--name=matrix-external-eclipse-egress"],
  ["--scene=eclipseScene", "--preset=eclipse-totality", "--name=matrix-eclipse-totality"],
  ["--scene=binaryExternal", "--preset=external-conjunction", "--name=matrix-external-conjunction"],
  ["--scene=binarySurface", "--preset=surface-sunrise", "--name=matrix-surface-sunrise"],
  ["--scene=binarySurface", "--preset=surface-noon", "--name=matrix-surface-noon"],
  ["--scene=binarySurface", "--preset=surface-summer-solstice", "--name=matrix-surface-summer-solstice"],
  ["--scene=binarySurface", "--preset=surface-equinox", "--name=matrix-surface-equinox"],
  ["--scene=binarySurface", "--preset=surface-winter-solstice", "--name=matrix-surface-winter-solstice"],
  ["--scene=binarySurface", "--preset=surface-sunset", "--name=matrix-surface-sunset"],
  ["--scene=binarySurface", "--preset=surface-second-sun", "--name=matrix-surface-second-sun"],
  ["--scene=binarySurface", "--preset=surface-night", "--name=matrix-surface-night"],
];

for (const entry of cases) {
  const result = spawnSync("node", ["scripts/headless-render.mjs", ...entry, "--wait-ms=1800"], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
