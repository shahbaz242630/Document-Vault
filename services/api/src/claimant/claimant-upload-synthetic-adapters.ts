import { createHash, timingSafeEqual } from "node:crypto";

import type { SyntheticEvidenceMediaType } from "@vault/shared-types";

import type { QuarantineStorageProcessorAdapterV1, StoredEvidenceInspectorAdapterV1 }
  from "./claimant-upload-processor.js";
import type { MalwareScannerAdapterV1 } from "./private-quarantine-service.js";

export const CLAIMANT_SYNTHETIC_UPLOAD_ADAPTERS_APPROVED = false as const;

export type SyntheticUploadFixtureV1 = Readonly<{ body: Uint8Array;
  mediaType: SyntheticEvidenceMediaType; pageCount: number | null;
  scanResult: "clean" | "malicious" | "error" | "timeout" }>;

export function createClaimantSyntheticUploadAdaptersV1(fixtures: Readonly<Record<string,
  SyntheticUploadFixtureV1>>, approved: boolean = CLAIMANT_SYNTHETIC_UPLOAD_ADAPTERS_APPROVED): Readonly<{
    inspector: StoredEvidenceInspectorAdapterV1; scanner: MalwareScannerAdapterV1;
    storage: QuarantineStorageProcessorAdapterV1;
  }> {
  if (!approved) throw new Error("Synthetic claimant upload adapters are disabled.");
  const stored = new Map<string, Uint8Array>();
  const fixture = (objectPath: string) => {
    const value = fixtures[objectPath];
    if (!value) throw new Error("Unknown synthetic upload fixture.");
    return value;
  };
  return {
    storage: {
      async exists({ objectPath }) { return stored.has(objectPath); },
      async put({ body, contentType, objectPath, signal }) {
        const expected = fixture(objectPath);
        if (expected.mediaType !== contentType) throw new Error("Synthetic media mismatch.");
        const chunks: Uint8Array[] = []; let length = 0;
        for await (const chunk of body) { if (signal.aborted) throw new Error("Synthetic upload aborted.");
          chunks.push(chunk.slice()); length += chunk.byteLength; }
        const candidate = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), length);
        if (!constantDigestEqual(candidate, expected.body)) throw new Error("Synthetic body mismatch.");
        stored.set(objectPath, candidate);
      },
      async remove({ objectPath }) { stored.delete(objectPath); },
    },
    inspector: { async inspect({ objectPath }) { const expected = fixture(objectPath);
      const body = stored.get(objectPath); if (!body) throw new Error("Synthetic object missing.");
      return { archiveEntryCount: 1, detectedMediaType: expected.mediaType,
        expandedSizeBytes: body.byteLength, pageCount: expected.pageCount, signatureValid: true }; } },
    scanner: { async scan({ objectPath }) { if (!stored.has(objectPath)) return "error";
      return fixture(objectPath).scanResult; } },
  };
}

function constantDigestEqual(actual: Uint8Array, expected: Uint8Array) {
  return actual.byteLength === expected.byteLength
    && timingSafeEqual(createHash("sha256").update(actual).digest(),
      createHash("sha256").update(expected).digest());
}
