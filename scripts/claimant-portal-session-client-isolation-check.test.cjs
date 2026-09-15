const assert = require("node:assert/strict");
const { join } = require("node:path");
const test = require("node:test");
const { collectSources } = require("./claimant-offline-code-v2-client-coordinator-isolation-check.cjs");
const { validateSources, path } = require("./claimant-portal-session-client-isolation-check.cjs");

const baseline = collectSources(join(__dirname, ".."));

test("claimant portal session client remains disabled and isolated", () => validateSources(baseline));

test("rejects activation and ambient adapters", () => {
  for (const mutate of [(source) => source.replace("APPROVED = false as const", "APPROVED = true as const"),
    (source) => `${source}\nfetch("https://example.test")`,
    (source) => `${source}\nimport auth from "@supabase/supabase-js"`]) {
    const sources = new Map(baseline);
    sources.set(path, mutate(sources.get(path)));
    assert.throws(() => validateSources(sources));
  }
});

test("rejects normal application importers", () => {
  const sources = new Map(baseline);
  sources.set("apps/mobile/app/claim.tsx",
    'import { createSyntheticClaimantPortalSessionClient } from "../src/features/claimant-session/portal-session-client";');
  assert.throws(() => validateSources(sources), /runtime importer/u);
});
