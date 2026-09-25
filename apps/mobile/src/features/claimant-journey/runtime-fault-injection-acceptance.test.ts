import { describe, expect, it, vi } from "vitest";

import { id } from "../claimant-handoff/fixtures.test";
import { createClaimantRuntimeBootstrap, mountDisabledClaimantRuntimeBootstrap } from "./runtime-bootstrap";
import { createClaimantRuntimeFoundation } from "./runtime-foundation";
import { harness, unavailable } from "./runtime-foundation.fixtures.test";

type Harness = ReturnType<typeof harness>;
type Runtime = ReturnType<typeof createClaimantRuntimeFoundation>;
type Bootstrap = ReturnType<typeof createClaimantRuntimeBootstrap>;
type Mock = Harness["portalSend"] | Harness["possessionSend"] | Harness["handoffSend"]
  | Harness["signClaimantHandoffAsync"];

const closedBootstrap = Object.freeze({ status: "closed", feature_enabled: false, kill_switch_engaged: true,
  runtime_ready: false, identity_verified: false, release_authorized: false });
const closedRuntime = Object.freeze({ status: "closed", portal_session_active: false, draft_available: false,
  identity_verified: false, relationship_verified: false, intake_started: false, review_started: false,
  release_authorized: false });
const leakPattern = /token|challenge|digest|signature|session_id|user_id|transcript|alias|fingerprint/iu;

type Stage = Readonly<{ name: string; mock: (h: Harness) => Mock; match: (url: string) => boolean;
  run: (runtime: Runtime, h: Harness) => Promise<unknown> }>;

const start = (runtime: Runtime, h: Harness) =>
  runtime.start({ attempt: h.attempt, sessionAssertionIdempotencyKey: id(102) });
const afterActivation = (operation: (runtime: Runtime, h: Harness) => Promise<unknown>) =>
  async (runtime: Runtime, h: Harness) => { await runtime.activatePortal(id(101)); return operation(runtime, h); };

const stages: readonly Stage[] = [
  { name: "portal activation", mock: (h) => h.portalSend, match: (url) => url.endsWith("/activate"),
    run: (runtime) => runtime.activatePortal(id(101)) },
  { name: "fresh portal assertion", mock: (h) => h.portalSend, match: (url) => url.endsWith("/assert"),
    run: afterActivation(start) },
  { name: "offline-code challenge", mock: (h) => h.possessionSend, match: (url) => !url.endsWith("/proofs"),
    run: afterActivation(start) },
  { name: "possession proof", mock: (h) => h.possessionSend, match: (url) => url.endsWith("/proofs"),
    run: afterActivation(start) },
  { name: "handoff issue", mock: (h) => h.handoffSend, match: (url) => url.endsWith("/issue"),
    run: afterActivation(start) },
  { name: "native handoff signing", mock: (h) => h.signClaimantHandoffAsync, match: () => true,
    run: afterActivation(start) },
  { name: "handoff completion", mock: (h) => h.handoffSend, match: (url) => !url.endsWith("/issue"),
    run: afterActivation(start) },
  { name: "portal revoke", mock: (h) => h.portalSend, match: (url) => url.endsWith("/revoke"),
    run: afterActivation((runtime) => runtime.revokePortal(id(104))) },
];

/** Holds the first matching adapter call open until the test settles it; later calls behave normally. */
function pause(stage: Stage, h: Harness) {
  const mock = stage.mock(h) as unknown as ReturnType<typeof vi.fn>;
  const original = mock.getMockImplementation() as (...args: unknown[]) => Promise<unknown>;
  let held: { args: unknown[]; resolve: (value: unknown) => void; reject: (error: unknown) => void } | null = null;
  let used = false;
  mock.mockImplementation((...args: unknown[]) => {
    const url = typeof args[0] === "string" ? args[0] : String(args[0] ?? "");
    if (used || !stage.match(url)) return original(...args);
    used = true;
    return new Promise((resolve, reject) => { held = { args, resolve, reject }; });
  });
  return {
    reached: () => held !== null,
    succeed: async () => { const call = held!; call.resolve(await original(...call.args)); },
    fail: () => { held!.reject(new TypeError("synthetic network outage detail")); },
  };
}

function build(h: Harness) {
  let runtime: Runtime | null = null;
  const createRuntime = vi.fn((input: Parameters<typeof createClaimantRuntimeFoundation>[0]) =>
    (runtime = createClaimantRuntimeFoundation(input)));
  const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true, killSwitchEngaged: false,
    runtime: h.options, createRuntime });
  if (!runtime) throw new Error("synthetic runtime was not constructed");
  return { bootstrap, runtime: runtime as Runtime, createRuntime };
}

const adapterCalls = (h: Harness) => [h.portalSend, h.possessionSend, h.handoffSend,
  h.signClaimantHandoffAsync, h.producer.produce].map((mock) => mock.mock.calls.length);

async function expectGenericRejection(operation: Promise<unknown>) {
  const error = await operation.then(() => { throw new Error("operation unexpectedly succeeded"); },
    (reason: unknown) => reason);
  expect(error).toMatchObject(unavailable);
  expect(Object.keys(error as object)).toEqual(["name"]);
  expect(String((error as Error).stack ?? "")).not.toMatch(leakPattern);
}

async function expectRetriesClosed(runtime: Runtime, h: Harness) {
  const before = adapterCalls(h);
  for (const retry of [() => runtime.retryActivation(), () => runtime.retryProof(id(103)),
    () => runtime.retryCompletion(id(105)), () => runtime.retryRevoke(), () => runtime.activatePortal(id(106)),
    () => start(runtime, h), () => runtime.revokePortal(id(107))])
    await expectGenericRejection(retry());
  expect(adapterCalls(h)).toEqual(before);
}

async function expectFullyClosed(bootstrap: Bootstrap, runtime: Runtime, h: Harness) {
  await bootstrap.dispose();
  expect(bootstrap.snapshot()).toEqual(closedBootstrap);
  expect(Object.isFrozen(bootstrap.snapshot())).toBe(true);
  expect(runtime.snapshot()).toEqual(closedRuntime);
  expect(Object.isFrozen(runtime.snapshot())).toBe(true);
  const subscribed = h.subscriptionCounts();
  expect(subscribed.auth).toBeGreaterThan(0); expect(subscribed.lifecycle).toBeGreaterThan(0);
  expect(h.authCleanup).toHaveBeenCalledTimes(subscribed.auth);
  expect(h.lifecycleCleanup).toHaveBeenCalledTimes(subscribed.lifecycle);
  expect(h.listenerCounts()).toEqual({ auth: 0, lifecycle: 0 });
}

type Fault = Readonly<{ name: string; inject: (bootstrap: Bootstrap, h: Harness) => void | Promise<void> }>;
const closingFaults: readonly Fault[] = [
  { name: "kill switch", inject: (bootstrap) => { bootstrap.engageKillSwitch(); } },
  { name: "background", inject: (bootstrap) => { bootstrap.handleAppState("background"); } },
  { name: "inactive", inject: (bootstrap) => { bootstrap.handleAppState("inactive"); } },
  { name: "bootstrap disposal", inject: (bootstrap) => { void bootstrap.dispose(); } },
  { name: "hosted identity drift", inject: (_bootstrap, h) => {
    h.emitAuth({ ...h.authenticated, accessToken: "drifted-synthetic-token" }); } },
];

describe("claimant runtime fault-injection acceptance", () => {
  it("keeps the normal application mount inert and constructs nothing", async () => {
    const bootstrap = mountDisabledClaimantRuntimeBootstrap();
    expect(bootstrap.snapshot()).toEqual({ status: "disabled", feature_enabled: false,
      kill_switch_engaged: true, runtime_ready: false, identity_verified: false, release_authorized: false });
    bootstrap.handleAppState("active"); bootstrap.engageKillSwitch();
    await expect(bootstrap.dispose()).resolves.toBeUndefined();
    expect(Object.keys(bootstrap).sort()).toEqual(["claimFlowRuntime", "dispose", "engageKillSwitch", "handleAppState",
      "snapshot"]);
    expect(bootstrap.claimFlowRuntime()).toBeNull();
  });

  it("drives the real bootstrap-to-journey chain to the value-free draft", async () => {
    const h = harness(); const { bootstrap, runtime, createRuntime } = build(h);
    expect(createRuntime).toHaveBeenCalledOnce();
    expect(bootstrap.snapshot()).toMatchObject({ status: "ready", runtime_ready: true, release_authorized: false });
    await runtime.activatePortal(id(101));
    await expect(start(runtime, h)).resolves.toMatchObject({ state: "draft", release_authorized: false });
    bootstrap.engageKillSwitch();
    await expectFullyClosed(bootstrap, runtime, h);
  });

  describe.each(stages)("while $name is in flight", (stage) => {
    it.each(closingFaults)("$name closes the chain and suppresses the late success", async (fault) => {
      const h = harness(); const { bootstrap, runtime } = build(h); const gate = pause(stage, h);
      const operation = stage.run(runtime, h); const rejection = expectGenericRejection(operation);
      await vi.waitFor(() => expect(gate.reached()).toBe(true));
      const callsAtFault = adapterCalls(h);
      await fault.inject(bootstrap, h);
      await gate.succeed();
      await rejection;
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(adapterCalls(h)).toEqual(callsAtFault);
      await expectRetriesClosed(runtime, h);
      await expectFullyClosed(bootstrap, runtime, h);
    });

    it("an outage rejects generically, and the kill switch then revokes any retained retry", async () => {
      const h = harness(); const { bootstrap, runtime } = build(h); const gate = pause(stage, h);
      const operation = stage.run(runtime, h); const rejection = expectGenericRejection(operation);
      await vi.waitFor(() => expect(gate.reached()).toBe(true));
      const callsAtFault = adapterCalls(h);
      gate.fail();
      await rejection;
      expect(adapterCalls(h)).toEqual(callsAtFault);
      expect(runtime.snapshot()).toMatchObject({ identity_verified: false, relationship_verified: false,
        intake_started: false, review_started: false, release_authorized: false });
      bootstrap.engageKillSwitch();
      await expectRetriesClosed(runtime, h);
      await expectFullyClosed(bootstrap, runtime, h);
    });

    it("the kill switch settles the operation even when the adapter never responds", async () => {
      const h = harness(); const { bootstrap, runtime } = build(h); const gate = pause(stage, h);
      const operation = stage.run(runtime, h); const rejection = expectGenericRejection(operation);
      await vi.waitFor(() => expect(gate.reached()).toBe(true));
      bootstrap.engageKillSwitch();
      await rejection;
      await expectFullyClosed(bootstrap, runtime, h);
    });
  });

  describe("races", () => {
    it("kill switch and completion success settling in the same turn never yield a draft", async () => {
      const h = harness(); const { bootstrap, runtime } = build(h);
      const gate = pause(stages.find((stage) => stage.name === "handoff completion")!, h);
      const operation = afterActivation(start)(runtime, h); const rejection = expectGenericRejection(operation);
      await vi.waitFor(() => expect(gate.reached()).toBe(true));
      const success = gate.succeed(); bootstrap.engageKillSwitch(); await success;
      await rejection;
      await expectFullyClosed(bootstrap, runtime, h);
    });

    it("concurrent disposal and lifecycle events during disposal close exactly once", async () => {
      const h = harness(); const { bootstrap, runtime } = build(h);
      await runtime.activatePortal(id(101));
      const first = bootstrap.dispose(); bootstrap.handleAppState("background");
      const second = bootstrap.dispose(); bootstrap.engageKillSwitch(); bootstrap.handleAppState("inactive");
      expect(second).toBe(first);
      await Promise.all([first, second]);
      bootstrap.engageKillSwitch(); bootstrap.handleAppState("active");
      await expectRetriesClosed(runtime, h);
      await expectFullyClosed(bootstrap, runtime, h);
    });

    it.each([
      ["hosted identity", (h: Harness) => ({ ...h.options, identity: { ...h.options.identity,
        expectedIssuer: "https://substituted.sanduqkin.test" } })],
      ["native signing", (h: Harness) => ({ ...h.options, signing: { ...h.options.signing,
        keyAliasReference: "not-a-synthetic-alias" } })],
      ["session journey", (h: Harness) => ({ ...h.options, journey: { ...h.options.journey,
        portal: { ...h.options.journey.portal, apiOrigin: "http://insecure.sanduqkin.test" } } })],
    ])("a %s construction failure closes the bootstrap and releases every boundary", async (_name, mutate) => {
      const h = harness();
      const bootstrap = createClaimantRuntimeBootstrap({ approved: true, enabled: true, killSwitchEngaged: false,
        runtime: mutate(h) });
      expect(bootstrap.snapshot()).toEqual(closedBootstrap);
      await bootstrap.dispose();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(h.listenerCounts()).toEqual({ auth: 0, lifecycle: 0 });
      expect(adapterCalls(h)).toEqual([0, 0, 0, 0, 0]);
    });
  });
});
