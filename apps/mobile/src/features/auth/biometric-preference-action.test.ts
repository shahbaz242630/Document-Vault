import { describe, expect, it, vi } from "vitest";

import { runBiometricPreferenceAction } from "./biometric-preference-action";

describe("runBiometricPreferenceAction", () => {
  it("invokes the real enable action when biometric unlock is off", async () => {
    const onDisable = vi.fn(async () => undefined);
    const onEnable = vi.fn(async () => undefined);

    await runBiometricPreferenceAction({ enabled: false, onDisable, onEnable });

    expect(onEnable).toHaveBeenCalledTimes(1);
    expect(onDisable).not.toHaveBeenCalled();
  });

  it("invokes the real disable action when biometric unlock is on", async () => {
    const onDisable = vi.fn(async () => undefined);
    const onEnable = vi.fn(async () => undefined);

    await runBiometricPreferenceAction({ enabled: true, onDisable, onEnable });

    expect(onDisable).toHaveBeenCalledTimes(1);
    expect(onEnable).not.toHaveBeenCalled();
  });
});
