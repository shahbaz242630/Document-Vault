const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");
const test = require("node:test");

const { files, collectSources, validateSheetCheckSources } = require("./claimant-sheet-check-isolation-check.cjs");

const sources = collectSources();
const change = (path, update) => { const next = new Map(sources); next.set(path, update(sources.get(path))); return next; };

test("claimant sheet check runs only in the Preview build and keeps nothing", () => {
  execFileSync(process.execPath, [join(__dirname, "claimant-sheet-check-isolation-check.cjs")], { stdio: "pipe" });
});

test("claimant sheet check fails closed when a gate is opened or loosened", () => {
  const lifecycle = "apps/mobile/src/features/claimant-offline-code/offline-code-v2-lifecycle.ts";
  const transport = "apps/mobile/src/features/claimant-offline-code/offline-code-v2-transport.ts";
  for (const path of [lifecycle, transport])
    assert.throws(() => validateSheetCheckSources(change(path, (text) => text.replace("= false as const;", "= true as const;"))));
  for (const [original, replacement] of [
    ["(CLAIMANT_OFFLINE_CODE_V2_LIFECYCLE_APPROVED || isClaimantPreviewBuild())", "true"],
    ["if (!isClaimantPreviewBuild()) return null;", ""],
    ["createOfflineCodeV2PlatformProofProducer(approved)", "createOfflineCodeV2PlatformProofProducer(true)"],
    ["approved: input.approved, syntheticOnly: true,", "approved: true, syntheticOnly: true,"],
  ]) assert.throws(() => validateSheetCheckSources(change(files.runtime, (text) => text.replace(original, replacement))));
});

test("claimant sheet check rejects storage, logging, display and reaching a claim", () => {
  for (const [path, addition] of [
    [files.runtime, 'import * as SecureStore from "expo-secure-store";'],
    [files.flow, "console.log(sheetText);"],
    [files.panel, "<BodyText>{sheetText}</BodyText>"],
    [files.panel, 'import { ClaimFlowPanel } from "./claim-flow-panel";'],
    [files.runtime, 'import { x } from "@/features/claimant-handoff/transport";'],
    [files.runtime, 'import { y } from "./offline-code-v2-transport";'],
    [files.route, 'import { useSheetCheckHandle } from "@/features/claimant-offline-code/sheet-check-runtime";'],
  ]) assert.throws(() => validateSheetCheckSources(change(path, (text) => `${addition}\n${text}`)), addition);
  assert.throws(() => validateSheetCheckSources(change(files.panel, (text) => text.replace("usePreventScreenCapture();", ""))));
  assert.throws(() => validateSheetCheckSources(change("apps/mobile/app/index.tsx",
    (text) => `import { SheetCheckPanel } from "@/features/claimant-journey/sheet-check-panel";\n${text}`)));
});
