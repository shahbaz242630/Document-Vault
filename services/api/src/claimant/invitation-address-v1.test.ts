import { describe, expect, it } from "vitest";

import {
  deriveInvitationAddressIndexV1,
  invitationAddressRequiresExactCaseConfirmationV1,
  invitationAddressIndexesEqualV1,
  normalizeInvitationAddressV1,
} from "./invitation-address-v1.js";

describe("invitation address V1", () => {
  it("preserves the case-sensitive ASCII local-part and lowercases only the DNS domain", () => {
    expect(normalizeInvitationAddressV1("\tAlice.Example+tag@MAIL.Example.COM ")).toBe(
      "Alice.Example+tag@mail.example.com",
    );
    expect(normalizeInvitationAddressV1("alice.example+tag@MAIL.EXAMPLE.COM")).toBe(
      "alice.example+tag@mail.example.com",
    );
  });

  it("rejects ambiguous, internationalized, quoted, commented, and invalid DNS forms", () => {
    for (const address of [
      "alice", "a@@example.com", "a..b@example.com", ".alice@example.com",
      "alice.@example.com", "\"alice\"@example.com", "alice(comment)@example.com",
      "álîce@example.com", "alice@example", "alice@-example.com", "alice@example-.com",
      "alice@example..com", "alice @example.com", "alice@example.com\n",
    ]) {
      expect(() => normalizeInvitationAddressV1(address), address).toThrow("Invitation address is invalid.");
    }
  });

  it("derives a stable domain-separated keyed index without folding local-part case", () => {
    const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
    const upper = deriveInvitationAddressIndexV1(key, "Alice@example.com");
    const repeat = deriveInvitationAddressIndexV1(key, "Alice@example.com");
    const lower = deriveInvitationAddressIndexV1(key, "alice@example.com");

    expect(Buffer.from(upper).toString("hex")).toBe(
      "55a0414da3bd4ab8869f43cdbfb7c1d6bfe73844242aa311fc8a1ad002902baf",
    );
    expect(invitationAddressIndexesEqualV1(upper, repeat)).toBe(true);
    expect(invitationAddressIndexesEqualV1(upper, lower)).toBe(false);
  });

  it("rejects malformed keys and non-canonical index inputs", () => {
    expect(() => deriveInvitationAddressIndexV1(new Uint8Array(31), "Alice@example.com")).toThrow(
      "Invitation address index input is invalid.",
    );
    expect(() => deriveInvitationAddressIndexV1(new Uint8Array(32), "Alice@EXAMPLE.com")).toThrow(
      "Invitation address index input is invalid.",
    );
    expect(invitationAddressIndexesEqualV1(new Uint8Array(31), new Uint8Array(31))).toBe(false);
  });
});

describe("invitation address issuance UX boundary", () => {
  it("requires explicit confirmation when the exact local-part contains uppercase", () => {
    expect(invitationAddressRequiresExactCaseConfirmationV1("John.Doe@example.com")).toBe(true);
    expect(invitationAddressRequiresExactCaseConfirmationV1("john.doe@example.com")).toBe(false);
  });

  it("preserves plus aliases as distinct addresses", () => {
    const key = new Uint8Array(32).fill(7);
    expect(deriveInvitationAddressIndexV1(key, "user+tag@example.com"))
      .not.toEqual(deriveInvitationAddressIndexV1(key, "user@example.com"));
  });
});
