import { createHash } from "node:crypto";

import { canonicalJsonBytes } from "@vault/shared-types";
import { describe, expect, it } from "vitest";

import { digestNativeEnrollmentRequestV1 } from "./native-enrollment-request-digest";

describe("native enrollment request digest", () => {
  it("hashes canonical JSON to an unpadded SHA-256 Base64URL digest", async () => {
    const value = { z: "last", a: { idempotency_key: "91000000-0000-4000-8000-000000000019" } };
    const expected = createHash("sha256").update(canonicalJsonBytes(value)).digest("base64url");
    await expect(digestNativeEnrollmentRequestV1(value)).resolves.toBe(expected);
  });

  it("rejects unsupported or non-integral request values", async () => {
    await expect(digestNativeEnrollmentRequestV1({ value: 1.5 })).rejects.toThrow();
    await expect(digestNativeEnrollmentRequestV1({ value: undefined })).rejects.toThrow();
    const cyclic: Record<string, unknown> = {}; cyclic.self = cyclic;
    await expect(digestNativeEnrollmentRequestV1(cyclic)).rejects.toThrow();
    await expect(digestNativeEnrollmentRequestV1({ value: new Date() })).rejects.toThrow();
  });
});
