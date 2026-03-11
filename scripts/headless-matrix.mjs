import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const cases = [
  ["--scene=clocktower", "--name=matrix-clocktower"],
  ["--scene=binaryExternal", "--preset=external-wide", "--name=matrix-external-wide"],
  ["--scene=binaryExternal", "--preset=external-conjunction", "--name=matrix-external-conjunction"],
  ["--scene=binarySurface", "--preset=surface-sunrise", "--name=matrix-surface-sunrise"],
  ["--scene=binarySurface", "--preset=surface-noon", "--name=matrix-surface-noon"],
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
