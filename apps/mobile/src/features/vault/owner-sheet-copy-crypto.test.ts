import sodium from "libsodium-wrappers-sumo";
import { describe, expect, it, vi } from "vitest";

import { createVaultSession } from "./vault-session";

vi.mock("@/features/claimant-offline-code/owner-offline-code-sheet-factory", () => ({ createOwnerOfflineCodeSheet: vi.fn() }));

const address = { ownerId: "10000000-0000-4000-8000-000000000001",
  locatorRecordId: "20000000-0000-4000-8000-000000000002" };

describe("owner sheet copies in the vault session", () => {
  it("seals and opens with the session's own key, and nothing else opens them", async () => {
    await sodium.ready;
    const session = createVaultSession({ key: sodium.randombytes_buf(32) });
    const sealed = await session.sealOwnerSheetCopy({ ...address, plaintext: "{\"secret\":\"SK2-S-1234\"}" });
    expect(JSON.stringify(sealed)).not.toContain("SK2-S-1234");
    await expect(session.openOwnerSheetCopy({ ...address, ...sealed })).resolves.toBe("{\"secret\":\"SK2-S-1234\"}");
    const otherVault = createVaultSession({ key: sodium.randombytes_buf(32) });
    await expect(otherVault.openOwnerSheetCopy({ ...address, ...sealed })).rejects.toThrow();
    await expect(session.openOwnerSheetCopy({ ...address, ownerId: "10000000-0000-4000-8000-0000000000ff", ...sealed }))
      .rejects.toThrow();
  });
});
