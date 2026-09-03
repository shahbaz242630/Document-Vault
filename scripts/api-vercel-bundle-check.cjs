const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const { dirname, join, normalize } = require("node:path");
const { pathToFileURL } = require("node:url");

const root = join(__dirname, "..");
const functionRoot = join(root, ".vercel", "output", "functions", "api", "index.func");
const configPath = join(functionRoot, ".vc-config.json");
if (!existsSync(configPath)) {
  throw new Error("Vercel API function output is missing. Run `vercel build` before this check.");
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.runtime !== "nodejs24.x" || config.handler !== "services/api/api/index.js") {
  throw new Error("Vercel API function runtime or handler drifted.");
}
const mapped = config.filePathMap?.["node_modules/@vault/shared-types"];
if (mapped !== "node_modules/@vault/shared-types") {
  throw new Error("Vercel did not retain the shared-types workspace mapping.");
}

const manifestPath = join(functionRoot, "packages", "shared-types", "package.json");
if (!existsSync(manifestPath)) throw new Error("Shared-types manifest is absent from the Vercel function.");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (manifest.main !== "dist/index.js" || manifest.types !== "src/index.ts") {
  throw new Error("Shared-types runtime/type entries are unsafe in the Vercel function.");
}
const runtimeEntry = normalize(join(dirname(manifestPath), manifest.main));
if (!existsSync(runtimeEntry)) {
  throw new Error(`Shared-types runtime entry is absent from the Vercel function: ${runtimeEntry}`);
}
const importResult = spawnSync(process.execPath, ["--input-type=module", "--eval",
  `await import(${JSON.stringify(pathToFileURL(runtimeEntry).href)})`], { encoding: "utf8" });
if (importResult.error || importResult.status !== 0) {
  throw new Error(`Shared-types Vercel runtime entry cannot load: ${importResult.stderr}`);
}

const apiEntry = join(functionRoot, config.handler);
if (!existsSync(apiEntry)) throw new Error("Compiled Vercel API handler is absent.");
