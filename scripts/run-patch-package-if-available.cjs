const { spawnSync } = require("node:child_process");
const { join } = require("node:path");

let patchPackageBin;
try {
  patchPackageBin = require.resolve("patch-package/index.js");
} catch {
  patchPackageBin = null;
}

if (patchPackageBin) {
  run(process.execPath, [patchPackageBin]);
}

run(process.execPath, [join(__dirname, "build-shared-types.cjs")]);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
