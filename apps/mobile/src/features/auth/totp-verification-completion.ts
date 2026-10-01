import type { TotpVerifyServiceResult } from "./totp-verify-service";
import type { TotpVerifyVariant } from "./totp-verify-view-model";

export type TotpVerificationNext = "/auth/recovery-phrase" | "/auth/sign-in" | "/vault";

export type TotpVerificationOutcome = Readonly<{
  next: TotpVerificationNext | null;
  result: TotpVerifyServiceResult;
}>;

type CompletionDeps = Readonly<{
  activateOwnerSession: () => Promise<unknown>;
  advanceSignupProgress: () => Promise<void>;
  takePendingSignIn: () => (() => Promise<void>) | null;
  verify: () => Promise<TotpVerifyServiceResult>;
}>;

/*
 * What happens after the owner types a TOTP code. Only a verified code (now AAL2) activates the owner's claimant
 * session control, with the session the code just raised, and only then does the vault unlock that sign-in left
 * waiting. Sign-up continues to the recovery phrase as before.
 */
export async function completeTotpVerification(
  variant: TotpVerifyVariant,
  deps: CompletionDeps,
): Promise<TotpVerificationOutcome> {
  const result = await deps.verify();

  if (result.status !== "ok") {
    return { next: null, result };
  }

  await deps.activateOwnerSession().catch(() => undefined);

  if (variant === "onboarding") {
    await deps.advanceSignupProgress();
    return { next: "/auth/recovery-phrase", result };
  }

  const unlock = deps.takePendingSignIn();

  if (!unlock) {
    return {
      next: "/auth/sign-in",
      result: { message: "Your sign-in timed out. Please sign in again.", status: "error" },
    };
  }

  await unlock();
  return { next: "/vault", result: { message: "Opening your vault.", status: "ok" } };
}
