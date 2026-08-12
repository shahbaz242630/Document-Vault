import type { ClaimantApiSession } from "./registered-recipient-client.js";

const MFA_METHODS = new Set(["mfa/phone", "mfa/totp", "mfa/webauthn", "totp"]);
const RECOVERY_METHODS = new Set(["recovery", "password_recovery"]);

export const CLAIMANT_MAX_FRESH_ASSURANCE_SECONDS = 600;

export class ClaimantAssuranceError extends Error {
  constructor() {
    super("Fresh multi-factor authentication is required.");
    this.name = "ClaimantAssuranceError";
  }
}

export function requireFreshClaimantAssurance(
  session: ClaimantApiSession,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
  maxAgeSeconds = CLAIMANT_MAX_FRESH_ASSURANCE_SECONDS,
): Readonly<{ authenticatedAt: string }> {
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 60 || maxAgeSeconds > 600) {
    throw new Error("Claimant fresh-assurance policy must be between 60 and 600 seconds.");
  }
  if (session.aal !== "aal2" || session.expiresAt <= nowEpochSeconds) {
    throw new ClaimantAssuranceError();
  }
  if (session.amr.some(({ method }) => RECOVERY_METHODS.has(method))) {
    throw new ClaimantAssuranceError();
  }

  const latestMfaTimestamp = Math.max(
    ...session.amr
      .filter(({ method }) => MFA_METHODS.has(method))
      .map(({ timestamp }) => timestamp),
    -1,
  );
  const age = nowEpochSeconds - latestMfaTimestamp;
  if (latestMfaTimestamp < 0 || age < -60 || age > maxAgeSeconds) {
    throw new ClaimantAssuranceError();
  }

  return { authenticatedAt: new Date(latestMfaTimestamp * 1000).toISOString() };
}
