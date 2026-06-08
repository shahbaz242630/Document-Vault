import type { AuditLog, AuditEventType } from "@/features/auth/audit-log";

import {
  generateEmergencyAccessCode,
} from "./emergency-access-code";
import {
  wrapMEKWithEmergencyCode,
  type EmergencyWrappedMEKPackage,
} from "./emergency-key-wrapping";

export type SealedEmergencyCodeGrantRepository = {
  revokeActiveSealedCodeGrants: () => Promise<void>;
  saveSealedCodeGrant: (
    grant: EmergencyWrappedMEKPackage,
  ) => Promise<EmergencyWrappedMEKPackage>;
};

export type SealedEmergencyCodeSetupResult = {
  code: string;
  status: "pending_confirmation";
};

export type SealedEmergencyCodeSetupOptions = {
  auditLog?: AuditLog;
  codeGenerator?: () => Promise<string>;
  mek: Uint8Array;
  repository: SealedEmergencyCodeGrantRepository;
  wrapMEK?: typeof wrapMEKWithEmergencyCode;
};

export async function createSealedEmergencyCodeSetup(
  options: SealedEmergencyCodeSetupOptions,
): Promise<SealedEmergencyCodeSetupResult> {
  return createAndSaveSealedCodeGrant({
    ...options,
    eventType: "sealed_emergency_code_created",
  });
}

export async function regenerateSealedEmergencyCodeSetup(
  options: SealedEmergencyCodeSetupOptions,
): Promise<SealedEmergencyCodeSetupResult> {
  await options.repository.revokeActiveSealedCodeGrants();

  return createAndSaveSealedCodeGrant({
    ...options,
    eventType: "sealed_emergency_code_regenerated",
    metadata: {
      grantType: "sealed_emergency_code",
      previousGrantRevoked: "true",
    },
  });
}

export async function revokeSealedEmergencyCodeSetup({
  auditLog,
  repository,
}: {
  auditLog?: AuditLog;
  repository: Pick<SealedEmergencyCodeGrantRepository, "revokeActiveSealedCodeGrants">;
}): Promise<void> {
  await repository.revokeActiveSealedCodeGrants();
  logSealedCodeEvent(auditLog, "sealed_emergency_code_revoked");
}

async function createAndSaveSealedCodeGrant({
  auditLog,
  codeGenerator = generateEmergencyAccessCode,
  eventType,
  mek,
  metadata,
  repository,
  wrapMEK = wrapMEKWithEmergencyCode,
}: SealedEmergencyCodeSetupOptions & {
  eventType: AuditEventType;
  metadata?: Record<string, string>;
}): Promise<SealedEmergencyCodeSetupResult> {
  const code = await codeGenerator();
  const { sealedPackage } = await wrapMEK({ emergencyCode: code, mek });
  await repository.saveSealedCodeGrant(sealedPackage);
  logSealedCodeEvent(auditLog, eventType, metadata);

  return {
    code,
    status: "pending_confirmation",
  };
}

function logSealedCodeEvent(
  auditLog: AuditLog | undefined,
  eventType: AuditEventType,
  metadata: Record<string, string> = { grantType: "sealed_emergency_code" },
) {
  auditLog?.log({
    deviceInfo: "React Native",
    eventType,
    metadata,
  });
}
