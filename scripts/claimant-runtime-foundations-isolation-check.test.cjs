const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");
const { paths, validateSources } = require("./claimant-runtime-foundations-isolation-check.cjs");

const baseline = collectSources(join(__dirname, ".."));

test("combined 5X-5Z foundations remain false and isolated", () => validateSources(baseline));

test("rejects activation and ambient identity, native, or runtime access", () => {
  for (const [path, mutate] of [[paths.identity, (source) => source.replace("APPROVED = false", "APPROVED = true")],
    [paths.signing, (source) => `${source}\nimport native from "../../../modules/claimant-key-custody/src"`],
    [paths.runtime, (source) => `${source}\nfetch("https://example.test")`],
    [paths.runtime, (source) => `${source}\nconst route = router`]]) {
    const sources = new Map(baseline); sources.set(path, mutate(sources.get(path)));
    assert.throws(() => validateSources(sources));
  }
});

test("rejects a normal application importer", () => {
  const sources = new Map(baseline);
  sources.set("apps/mobile/app/claimant.tsx",
    'import { createClaimantRuntimeFoundation } from "../src/features/claimant-journey/runtime-foundation";');
  assert.throws(() => validateSources(sources), /runtime-foundation importer/u);
});
