import { describe, expect, it, vi } from "vitest";

import {
  getBiometricPreferenceControlState,
  runBiometricPreferenceAction,
} from "./biometric-preference-action";

describe("getBiometricPreferenceControlState", () => {
  it.each([
    {
      expected: {
        actionColor: "inkSecondary",
        disabled: true,
        label: "Updating biometric unlock",
      },
      input: { canEnable: true, enabled: true, isBusy: true, isCheckingSupport: false },
    },
    {
      expected: {
        actionColor: "inkSecondary",
        disabled: true,
        label: "Checking biometric availability",
      },
      input: { canEnable: false, enabled: false, isBusy: false, isCheckingSupport: true },
    },
    {
      expected: {
        actionColor: "danger",
        disabled: false,
        label: "Disable biometric unlock",
      },
      input: { canEnable: false, enabled: true, isBusy: false, isCheckingSupport: false },
    },
    {
      expected: {
        actionColor: "action",
        disabled: false,
        label: "Enable biometric unlock",
      },
      input: { canEnable: true, enabled: false, isBusy: false, isCheckingSupport: false },
    },
    {
      expected: {
        actionColor: "inkSecondary",
        disabled: true,
        label: "Biometric unlock unavailable",
      },
      input: { canEnable: false, enabled: false, isBusy: false, isCheckingSupport: false },
    },
  ])("returns the accessible $expected.label state", ({ expected, input }) => {
    expect(getBiometricPreferenceControlState(input)).toMatchObject(expected);
  });
});

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
