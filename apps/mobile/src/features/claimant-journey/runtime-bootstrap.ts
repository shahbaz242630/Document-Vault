import { createClaimantRuntimeFoundation } from "./runtime-foundation";
import { readClaimantRuntimeLaunchPolicy } from "./runtime-launch-policy";

export const CLAIMANT_RUNTIME_BOOTSTRAP_APPROVED = false as const;

type RuntimeFactory = typeof createClaimantRuntimeFoundation;
type RuntimeInput = Parameters<RuntimeFactory>[0];
type Runtime = ReturnType<RuntimeFactory>;

type StartInput = Parameters<Runtime["start"]>[0];

/** The only claimant operations a screen may reach, and only while the bootstrap is ready. */
export type ClaimantClaimFlowRuntime = Readonly<{
  activatePortal(key: string): Promise<void>;
  start(value: StartInput): Promise<unknown>;
  isOpen(): boolean;
}>;

type Input = Readonly<{
  approved?: boolean;
  enabled?: boolean;
  killSwitchEngaged?: boolean;
  runtime?: RuntimeInput;
  createRuntime?: RuntimeFactory;
}>;

function safeSnapshot(status: "disabled" | "ready" | "closed", enabled = false) {
  return Object.freeze({
    status,
    feature_enabled: enabled,
    kill_switch_engaged: status !== "ready",
    runtime_ready: status === "ready",
    identity_verified: false as const,
    release_authorized: false as const,
  });
}

function inert(status: "disabled" | "closed" = "disabled", disposal = Promise.resolve()) {
  return Object.freeze({
    handleAppState(_state: string) {},
    engageKillSwitch() {},
    claimFlowRuntime: (): ClaimantClaimFlowRuntime | null => null,
    dispose: () => disposal,
    snapshot: () => safeSnapshot(status),
  });
}

function closeRuntime(runtime: Runtime): Promise<void> {
  try { runtime.cancel(); } catch { /* The bootstrap always fails closed. */ }
  // Dispose synchronously so no runtime operation is accepted after the kill switch returns.
  try { return Promise.resolve(runtime.dispose()).catch(() => undefined); } catch { return Promise.resolve(); }
}

class RuntimeBootstrap {
  private runtime: Runtime | null;
  private closed = false;
  private disposal: Promise<void> | null = null;

  constructor(runtime: Runtime) {
    this.runtime = runtime;
  }

  private close(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.closed = true;
    const runtime = this.runtime;
    this.runtime = null;
    if (!runtime) return Promise.resolve();
    this.disposal = closeRuntime(runtime);
    return this.disposal;
  }

  handleAppState(state: string): void {
    if (state === "background" || state === "inactive") void this.close();
  }

  engageKillSwitch(): void {
    void this.close();
  }

  claimFlowRuntime(): ClaimantClaimFlowRuntime | null {
    if (this.closed || !this.runtime) return null;
    const current = () => {
      if (this.closed || !this.runtime) throw new Error();
      return this.runtime;
    };
    return Object.freeze({
      activatePortal: (key: string) => Promise.resolve().then(() => current().activatePortal(key)),
      start: (value: StartInput) => Promise.resolve().then(() => current().start(value)),
      isOpen: () => !this.closed,
    });
  }

  dispose(): Promise<void> {
    return this.close();
  }

  snapshot() {
    return safeSnapshot(this.closed ? "closed" : "ready", !this.closed);
  }
}

export function createClaimantRuntimeBootstrap(input: Input = {}) {
  const approved = input.approved ?? CLAIMANT_RUNTIME_BOOTSTRAP_APPROVED;
  if (!approved) return inert();
  if (input.enabled !== true || input.killSwitchEngaged !== false) return inert();

  let runtime: Runtime | null = null;
  try {
    const runtimeInput = input.runtime;
    if (runtimeInput?.syntheticOnly !== true || runtimeInput.productionRuntime !== false) return inert("closed");
    const createRuntime = input.createRuntime ?? createClaimantRuntimeFoundation;
    runtime = createRuntime({ ...runtimeInput, approved: true });
    const status = runtime.snapshot().status;
    if (status === "disabled" || status === "closed") {
      return inert("closed", closeRuntime(runtime));
    }
    const bootstrap = new RuntimeBootstrap(runtime);
    return Object.freeze({
      handleAppState: bootstrap.handleAppState.bind(bootstrap),
      engageKillSwitch: bootstrap.engageKillSwitch.bind(bootstrap),
      claimFlowRuntime: bootstrap.claimFlowRuntime.bind(bootstrap),
      dispose: bootstrap.dispose.bind(bootstrap),
      snapshot: bootstrap.snapshot.bind(bootstrap),
    });
  } catch {
    return runtime ? inert("closed", closeRuntime(runtime)) : inert("closed");
  }
}

export function mountDisabledClaimantRuntimeBootstrap() {
  const launchPolicy = readClaimantRuntimeLaunchPolicy();
  return createClaimantRuntimeBootstrap({
    approved: launchPolicy.approved,
    enabled: launchPolicy.enabled,
    killSwitchEngaged: launchPolicy.killSwitchEngaged,
  });
}
