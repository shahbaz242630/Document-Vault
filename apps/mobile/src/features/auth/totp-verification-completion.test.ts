import { describe, expect, it, vi } from "vitest";

import { completeTotpVerification } from "./totp-verification-completion";
import type { TotpVerifyServiceResult } from "./totp-verify-service";

const ok: TotpVerifyServiceResult = { message: "Two-factor authentication is now active.", status: "ok" };
const rejected: TotpVerifyServiceResult = { message: "The code could not be verified. Try again.", status: "error" };

function deps(result: TotpVerifyServiceResult, pending: (() => Promise<void>) | null) {
  const order: string[] = [];
  const unlock = vi.fn(async () => { order.push("unlock"); });
  return {
    order,
    unlock,
    deps: {
      activateOwnerSession: vi.fn(async () => { order.push("activate"); }),
      advanceSignupProgress: vi.fn(async () => { order.push("progress"); }),
      takePendingSignIn: vi.fn(() => (pending === null ? null : unlock)),
      verify: vi.fn(async () => { order.push("verify"); return result; }),
    },
  };
}

describe("completing a TOTP check", () => {
  it.each(["returning", "enrollment"] as const)(
    "%s: verifies, activates the owner session, and only then opens the vault left waiting at sign-in",
    async (variant) => {
      const setup = deps(ok, async () => undefined);
      await expect(completeTotpVerification(variant, setup.deps)).resolves.toEqual({
        next: "/vault",
        result: { message: "Opening your vault.", status: "ok" },
      });
      expect(setup.order).toEqual(["verify", "activate", "unlock"]);
      expect(setup.deps.advanceSignupProgress).not.toHaveBeenCalled();
    },
  );

  it("does nothing else when the code is rejected: no activation and no vault", async () => {
    const setup = deps(rejected, async () => undefined);
    await expect(completeTotpVerification("returning", setup.deps)).resolves.toEqual({ next: null, result: rejected });
    expect(setup.order).toEqual(["verify"]);
    expect(setup.deps.takePendingSignIn).not.toHaveBeenCalled();
  });

  it("sends the owner back to sign-in when the waiting unlock has gone", async () => {
    const setup = deps(ok, null);
    await expect(completeTotpVerification("returning", setup.deps)).resolves.toEqual({
      next: "/auth/sign-in",
      result: { message: "Your sign-in timed out. Please sign in again.", status: "error" },
    });
    expect(setup.unlock).not.toHaveBeenCalled();
  });

  it("still opens the vault when the claimant session activation fails", async () => {
    const setup = deps(ok, async () => undefined);
    setup.deps.activateOwnerSession.mockRejectedValueOnce(new Error("offline"));
    await expect(completeTotpVerification("returning", setup.deps)).resolves.toMatchObject({ next: "/vault" });
    expect(setup.unlock).toHaveBeenCalledOnce();
  });

  it("keeps sign-up on its path to the recovery phrase", async () => {
    const setup = deps(ok, null);
    await expect(completeTotpVerification("onboarding", setup.deps)).resolves.toEqual({
      next: "/auth/recovery-phrase",
      result: ok,
    });
    expect(setup.order).toEqual(["verify", "activate", "progress"]);
    expect(setup.deps.takePendingSignIn).not.toHaveBeenCalled();
  });
});
