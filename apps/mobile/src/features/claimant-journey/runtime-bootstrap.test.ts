import { describe, expect, it, vi } from "vitest";

import type { createClaimantRuntimeFoundation } from "./runtime-foundation";
import {
  createClaimantRuntimeBootstrap,
  mountDisabledClaimantRuntimeBootstrap,
} from "./runtime-bootstrap";

type RuntimeFactory = typeof createClaimantRuntimeFoundation;
type RuntimeInput = Parameters<RuntimeFactory>[0];

function activeHarness(status = "idle") {
  const runtime = {
    cancel: vi.fn(),
    dispose: vi.fn(async () => undefined),
    snapshot: vi.fn(() => ({ status })),
  };
  const createRuntime = vi.fn(() => runtime) as unknown as RuntimeFactory;
  const input = { syntheticOnly: true, productionRuntime: false } as RuntimeInput;
  return { runtime, createRuntime, input };
}

describe("claimant runtime bootstrap", () => {
  it("mounts dormant without reading activation dependencies", () => {
    const input = Object.defineProperties({}, {
      approved: { get: () => false },
      enabled: { get: () => { throw new Error("enabled accessed"); } },
      killSwitchEngaged: { get: () => { throw new Error("kill switch accessed"); } },
      runtime: { get: () => { throw new Error("runtime accessed"); } },
      createRuntime: { get: () => { throw new Error("factory accessed"); } },
    });

    const bootstrap = createClaimantRuntimeBootstrap(input);

    expect(bootstrap.snapshot()).toEqual({ status: "disabled", feature_enabled: false,
      kill_switch_engaged: true, runtime_ready: false, identity_verified: false,
      release_authorized: false });
  });

  it("does not create a runtime while the feature is disabled", () => {
    const createRuntime = vi.fn(() => { throw new Error("factory accessed"); });
    const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: false,
      killSwitchEngaged: false, createRuntime: createRuntime as unknown as RuntimeFactory });

    expect(createRuntime).not.toHaveBeenCalled();
    expect(bootstrap.snapshot().status).toBe("disabled");
  });

  it("does not create a runtime while the kill switch is engaged", () => {
    const createRuntime = vi.fn(() => { throw new Error("factory accessed"); });
    const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true,
      killSwitchEngaged: true, createRuntime: createRuntime as unknown as RuntimeFactory });

    expect(createRuntime).not.toHaveBeenCalled();
    expect(bootstrap.snapshot().kill_switch_engaged).toBe(true);
  });

  it("creates only an explicitly approved synthetic runtime", () => {
    const harness = activeHarness();
    const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true,
      killSwitchEngaged: false, runtime: harness.input, createRuntime: harness.createRuntime });

    expect(harness.createRuntime).toHaveBeenCalledWith({ ...harness.input, approved: true });
    expect(bootstrap.snapshot()).toEqual({ status: "ready", feature_enabled: true,
      kill_switch_engaged: false, runtime_ready: true, identity_verified: false,
      release_authorized: false });
    bootstrap.handleAppState("active");
    expect(harness.runtime.cancel).not.toHaveBeenCalled();
  });

  it.each(["background", "inactive"])("closes on %s and ignores duplicate lifecycle events", async (state) => {
    const harness = activeHarness();
    const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true,
      killSwitchEngaged: false, runtime: harness.input, createRuntime: harness.createRuntime });

    bootstrap.handleAppState(state);
    bootstrap.handleAppState(state);
    await bootstrap.dispose();

    expect(harness.runtime.cancel).toHaveBeenCalledTimes(1);
    expect(harness.runtime.dispose).toHaveBeenCalledTimes(1);
    expect(bootstrap.snapshot().status).toBe("closed");
  });

  it("engages the kill switch once and fails closed", async () => {
    const harness = activeHarness();
    const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true,
      killSwitchEngaged: false, runtime: harness.input, createRuntime: harness.createRuntime });

    bootstrap.engageKillSwitch();
    bootstrap.engageKillSwitch();
    await bootstrap.dispose();

    expect(harness.runtime.cancel).toHaveBeenCalledTimes(1);
    expect(harness.runtime.dispose).toHaveBeenCalledTimes(1);
    expect(bootstrap.snapshot()).toMatchObject({ status: "closed", feature_enabled: false,
      kill_switch_engaged: true, runtime_ready: false });
  });

  it("rejects a disabled underlying runtime without exposing detail", async () => {
    const harness = activeHarness("disabled");
    const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true,
      killSwitchEngaged: false, runtime: harness.input, createRuntime: harness.createRuntime });

    await bootstrap.dispose();
    expect(harness.runtime.cancel).toHaveBeenCalledTimes(1);
    expect(harness.runtime.dispose).toHaveBeenCalledTimes(1);
    expect(bootstrap.snapshot()).toEqual({ status: "closed", feature_enabled: false,
      kill_switch_engaged: true, runtime_ready: false, identity_verified: false,
      release_authorized: false });
  });

  it("closes a runtime whose readiness check fails", async () => {
    const harness = activeHarness();
    harness.runtime.snapshot.mockImplementation(() => { throw new Error("private provider detail"); });
    const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true,
      killSwitchEngaged: false, runtime: harness.input, createRuntime: harness.createRuntime });

    await bootstrap.dispose();
    expect(harness.runtime.cancel).toHaveBeenCalledTimes(1);
    expect(harness.runtime.dispose).toHaveBeenCalledTimes(1);
    expect(bootstrap.snapshot()).toMatchObject({ status: "closed", runtime_ready: false });
  });

  it("keeps the normal application mount permanently inert", async () => {
    const bootstrap = mountDisabledClaimantRuntimeBootstrap();
    bootstrap.handleAppState("background");
    bootstrap.engageKillSwitch();
    await bootstrap.dispose();

    expect(bootstrap.snapshot().status).toBe("disabled");
  });
});
