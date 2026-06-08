import { describe, expect, it } from "vitest";

import { createAuditLog } from "@/features/auth/audit-log";
import { generateMasterEncryptionKey } from "@/shared/crypto/vault-crypto";

import type { EmergencyWrappedMEKPackage } from "./emergency-key-wrapping";
import {
  createSealedEmergencyCodeSetup,
  regenerateSealedEmergencyCodeSetup,
  revokeSealedEmergencyCodeSetup,
  type SealedEmergencyCodeGrantRepository,
} from "./sealed-emergency-code-service";

describe("sealed emergency code service", () => {
  it("creates a sealed code grant and returns the raw code only for one-time display", async () => {
    const repository = createEmergencyGrantRepositoryDouble();
    const auditLog = createAuditLog();

    const result = await createSealedEmergencyCodeSetup({
      auditLog,
      codeGenerator: async () => "K7Q9-M2XD-8V4P-ZR6T-AL3N",
      mek: await generateMasterEncryptionKey(),
      repository,
    });

    expect(result).toEqual({
      code: "K7Q9-M2XD-8V4P-ZR6T-AL3N",
      status: "pending_confirmation",
    });
    expect(repository.savedGrants).toHaveLength(1);
    expect(JSON.stringify(repository.savedGrants)).not.toContain("K7Q9");
    expect(auditLog.events).toMatchObject([
      {
        eventType: "sealed_emergency_code_created",
        metadata: { grantType: "sealed_emergency_code" },
      },
    ]);
    expect(JSON.stringify(auditLog.events)).not.toContain("K7Q9");
    expect(JSON.stringify(auditLog.events)).not.toContain("ciphertext");
    expect(JSON.stringify(auditLog.events)).not.toContain("salt");
  });

  it("regenerates by revoking active grants before saving a replacement", async () => {
    const repository = createEmergencyGrantRepositoryDouble();
    const auditLog = createAuditLog();

    const result = await regenerateSealedEmergencyCodeSetup({
      auditLog,
      codeGenerator: async () => "K7Q9-M2XD-8V4P-ZR6T-AL3N",
      mek: await generateMasterEncryptionKey(),
      repository,
    });

    expect(result.status).toBe("pending_confirmation");
    expect(repository.revocations).toBe(1);
    expect(repository.savedGrants).toHaveLength(1);
    expect(auditLog.events[0]?.eventType).toBe("sealed_emergency_code_regenerated");
    expect(auditLog.events[0]?.metadata).toEqual({
      grantType: "sealed_emergency_code",
      previousGrantRevoked: "true",
    });
  });

  it("revokes active sealed code grants with safe audit metadata", async () => {
    const repository = createEmergencyGrantRepositoryDouble();
    const auditLog = createAuditLog();

    await revokeSealedEmergencyCodeSetup({ auditLog, repository });

    expect(repository.revocations).toBe(1);
    expect(auditLog.events).toMatchObject([
      {
        eventType: "sealed_emergency_code_revoked",
        metadata: { grantType: "sealed_emergency_code" },
      },
    ]);
    expect(JSON.stringify(auditLog.events[0]?.metadata)).not.toContain("K7Q9");
    expect(JSON.stringify(auditLog.events[0]?.metadata)).not.toContain("mek");
    expect(JSON.stringify(auditLog.events[0]?.metadata)).not.toContain("notes");
  });
});

function createEmergencyGrantRepositoryDouble(): SealedEmergencyCodeGrantRepository & {
  revocations: number;
  savedGrants: EmergencyWrappedMEKPackage[];
} {
  const savedGrants: EmergencyWrappedMEKPackage[] = [];
  let revocations = 0;

  return {
    get revocations() {
      return revocations;
    },
    savedGrants,
    async revokeActiveSealedCodeGrants() {
      revocations += 1;
    },
    async saveSealedCodeGrant(grant) {
      savedGrants.push(grant);

      return grant;
    },
  };
}
