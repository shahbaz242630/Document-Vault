const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const featureRoot = join(root, "apps/mobile/src/features/claimant-retrieval");
const coordinator = readFileSync(join(featureRoot, "native-local-export-coordinator.ts"), "utf8");
const adapter = readFileSync(join(featureRoot, "native-local-export-adapter.ts"), "utf8");

test("keeps native local export immutable-false", () => {
  assert.match(coordinator, /CLAIMANT_NATIVE_LOCAL_EXPORT_APPROVED = false as const/u);
  assert.match(adapter, /CLAIMANT_NATIVE_LOCAL_EXPORT_ADAPTER_APPROVED = false as const/u);
});

test("requires exact completed, active, unexported authority", () => {
  for (const token of ["packageServed: z.literal(true)", "retrievalCompleted: z.literal(true)",
    "retrievalAccessState: z.literal(\"active\")",
    "finalizationStatus: z.literal(\"finalized_release_ready\")",
    "exportPerformed: z.literal(false)", "closureRecorded: z.literal(false)"])
    assert.ok(coordinator.includes(token), token);
});

test("requires explicit native confirmation and fresh user presence", () => {
  assert.match(coordinator, /exportIntent: z\.literal\("claimant_explicit_local_copy"\)/u);
  assert.match(adapter, /require_explicit_confirmation: true/u);
  assert.match(adapter, /require_fresh_user_presence: true/u);
  assert.match(coordinator, /exported - authenticated <= 120_000/u);
  assert.match(coordinator, /current - requested <= 120_000/u);
});

test("cross-binds exact local open and export receipt authority", () => {
  for (const token of ["result.completion_id === request.completionId",
    "result.delivery_id === request.deliveryId", "result.interaction_id === request.interactionId",
    "result.open_session_reference === request.openSessionReference",
    "result.release_package_id === request.releasePackageId",
    "result.retrieval_session_id === request.retrievalSessionId"])
    assert.ok(coordinator.includes(token), token);
  assert.match(coordinator, /claimant-local-export\\\.v1/u);
});

test("returns a value-free receipt and keeps server upload and closure false", () => {
  for (const token of ["plaintext_returned_to_javascript: z.literal(false)",
    "server_upload_performed: z.literal(false)", "closure_recorded: z.literal(false)",
    "destination_class: z.literal(\"user_selected_local_copy\")"])
    assert.ok(coordinator.includes(token) && adapter.includes(token), token);
  const result = coordinator.slice(coordinator.indexOf("return { assetCount"),
    coordinator.indexOf("} catch (error)"));
  assert.doesNotMatch(result, /openSessionReference|filePath|filename|contentBytes|dataUrl/u);
});

test("serializes work and handles cancellation without direct native binding", () => {
  assert.match(coordinator, /if \(running\) throw new NativeLocalExportError/u);
  assert.match(coordinator, /active\(signal\)/u);
  assert.doesNotMatch(adapter, /requireNativeModule|NativeModules|expo-modules-core/u);
});
