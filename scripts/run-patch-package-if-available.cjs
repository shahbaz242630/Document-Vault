const { spawnSync } = require("node:child_process");

let patchPackageBin;
try {
  patchPackageBin = require.resolve("patch-package/index.js");
} catch {
  process.exit(0);
}

const result = spawnSync(process.execPath, [patchPackageBin], {
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 0);
