const { rmSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const { buildSync } = require("esbuild");

const root = join(__dirname, "..");
const packageRoot = join(root, "packages", "shared-types");
const outputRoot = join(packageRoot, "dist");
rmSync(outputRoot, { force: true, recursive: true });

const typescriptBin = require.resolve("typescript/bin/tsc");
const declarationResult = spawnSync(process.execPath, [typescriptBin, "--project",
  join(packageRoot, "tsconfig.build.json")], { stdio: "inherit" });
if (declarationResult.error) throw declarationResult.error;
if (declarationResult.status !== 0) process.exit(declarationResult.status ?? 1);

buildSync({ bundle: true, entryPoints: [join(packageRoot, "src", "index.ts")],
  format: "esm", legalComments: "none", outfile: join(outputRoot, "index.js"),
  platform: "node", sourcemap: true, target: "node24" });
