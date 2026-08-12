import { describe, expect, it } from "vitest";

import {
  deriveConfirmedRecipientAddressDigestV1,
  deriveControllerAppAttestKeyIdDigestV1,
  deriveControllerDeviceBindingDigestV1,
} from "./native-enrollment-controller-bindings.js";

describe("native enrollment controller server-derived bindings", () => {
  it("preserves confirmed local-part case and canonicalizes only the address domain", () => {
    const key = Buffer.alloc(32, 1);
    expect(deriveConfirmedRecipientAddressDigestV1(key, " Alice.Example@MAIL.Example.COM "))
      .toBe(deriveConfirmedRecipientAddressDigestV1(key, "Alice.Example@mail.example.com"));
    expect(deriveConfirmedRecipientAddressDigestV1(key, "Alice.Example@example.com"))
      .not.toBe(deriveConfirmedRecipientAddressDigestV1(key, "alice.example@example.com"));
  });

  it("derives canonical App Attest and keyed device-context digests", () => {
    const keyId = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 1)).toString("base64");
    const appDigest = deriveControllerAppAttestKeyIdDigestV1(keyId);
    expect(appDigest).toHaveLength(43);
    const first = deriveControllerDeviceBindingDigestV1(Buffer.alloc(32, 2),
      "21000000-0000-4000-8000-000000000002", appDigest);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(deriveControllerDeviceBindingDigestV1(Buffer.alloc(32, 3),
      "21000000-0000-4000-8000-000000000002", appDigest));
  });

  it("rejects malformed keys and noncanonical App Attest identifiers", () => {
    expect(() => deriveControllerAppAttestKeyIdDigestV1("A".repeat(44))).toThrow("binding is invalid");
    expect(() => deriveControllerDeviceBindingDigestV1(Buffer.alloc(31),
      "21000000-0000-4000-8000-000000000002", "A".repeat(43))).toThrow("binding is invalid");
  });
});
