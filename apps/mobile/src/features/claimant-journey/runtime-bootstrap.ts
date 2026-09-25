import { createClaimantRuntimeFoundation } from "./runtime-foundation";

export const CLAIMANT_RUNTIME_BOOTSTRAP_APPROVED = false as const;

type RuntimeFactory = typeof createClaimantRuntimeFoundation;
type RuntimeInput = Parameters<RuntimeFactory>[0];
type Runtime = ReturnType<RuntimeFactory>;

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
    dispose: () => disposal,
    snapshot: () => safeSnapshot(status),
  });
}

function closeRuntime(runtime: Runtime): Promise<void> {
  try { runtime.cancel(); } catch { /* The bootstrap always fails closed. */ }
  return Promise.resolve().then(() => runtime.dispose()).catch(() => undefined);
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
      dispose: bootstrap.dispose.bind(bootstrap),
      snapshot: bootstrap.snapshot.bind(bootstrap),
    });
  } catch {
    return runtime ? inert("closed", closeRuntime(runtime)) : inert("closed");
  }
}

export function mountDisabledClaimantRuntimeBootstrap() {
  return createClaimantRuntimeBootstrap();
}
