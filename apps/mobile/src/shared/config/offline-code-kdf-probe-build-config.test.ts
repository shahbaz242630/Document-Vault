import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { OFFLINE_CODE_V2_KDF_PROBE_FIXTURE } from "../../features/claimant-offline-code/offline-code-v2-kdf-probe-fixture";

const repositoryRoot = resolve(__dirname, "../../../../..");
const mobileRoot = resolve(repositoryRoot, "apps/mobile");
const nodeRequire = createRequire(import.meta.url);
const configFactory = nodeRequire(resolve(mobileRoot, "app.config.js")) as () => {
  name: string; scheme: string;
  android: { package: string };
  ios: { bundleIdentifier: string };
  plugins: (string | [string, Record<string, unknown>])[];
  extra: { claimantIsolatedProbeBuild: boolean; claimantOfflineCodeKdfProbeBuild: boolean };
};

describe("offline-code KDF probe build isolation", () => {
  it("keeps the ordinary application identity, router, and probe flag unchanged", () => {
    withBuildTarget(undefined, () => {
      const config = configFactory();
      expect(config).toMatchObject({ name: "Sanduqkin", scheme: "sanduqkin",
        android: { package: "com.sanduqkin.mobile" },
        ios: { bundleIdentifier: "com.sanduqkin.mobile" },
        extra: { claimantIsolatedProbeBuild: false, claimantOfflineCodeKdfProbeBuild: false } });
      expect(routerRoot(config.plugins)).toBe("./app");
    });
  });

  it("uses separate iOS/Android identities and router root only for the KDF probe", () => {
    withBuildTarget("claimant_offline_code_kdf_probe", () => {
      const config = configFactory();
      expect(config).toMatchObject({
        name: "Sanduqkin KDF Probe",
        scheme: "sanduqkin-claimant-kdf-probe",
        android: { package: "com.sanduqkin.mobile.claimantkdfprobe" },
        ios: { bundleIdentifier: "com.sanduqkin.mobile.claimantkdfprobe" },
        extra: { claimantIsolatedProbeBuild: true, claimantOfflineCodeKdfProbeBuild: true },
      });
      expect(routerRoot(config.plugins)).toBe("./offline-code-kdf-probe-app");
    });
  });

  it("defines one internal physical-device EAS profile and a value-free host", () => {
    const eas = JSON.parse(readFileSync(resolve(mobileRoot, "eas.json"), "utf8")) as {
      build: Record<string, unknown>;
    };
    expect(eas.build["claimant-offline-code-kdf-probe"]).toEqual({
      developmentClient: false,
      distribution: "internal",
      environment: "preview",
      env: { SANDUQKIN_BUILD_TARGET: "claimant_offline_code_kdf_probe" },
      android: { buildType: "apk" },
      ios: { credentialsSource: "remote", simulator: false },
    });
    const source = readFileSync(resolve(mobileRoot, "offline-code-kdf-probe-app/index.tsx"), "utf8");
    expect(source).toContain("createOfflineCodeV2KdfEvidenceRunner");
    expect(source).toContain("createOfflineCodeV2PlatformProofProducer");
    expect(source).toContain("sampleCount: 5");
    expect(source).not.toMatch(/fetch\(|axios|supabase|SecureStore|AsyncStorage|storage\.from/iu);
    for (const prohibitedDisplay of ["durations_ms", "synthetic_client_secret.secret", ".salt",
      ".root", ".signature", ".device.model", ".device.osVersion"])
      expect(source).not.toContain(prohibitedDisplay);
    const vector = JSON.parse(readFileSync(resolve(repositoryRoot,
      "packages/shared-types/test-vectors/claim/offline-code-v2.json"), "utf8")) as Record<string, unknown>;
    expect(OFFLINE_CODE_V2_KDF_PROBE_FIXTURE).toEqual({
      publicLocator: vector.public_locator,
      clientSecret: vector.synthetic_client_secret,
      kdfProfile: vector.kdf_profile,
      recordBinding: vector.record_binding,
    });
  });
});

function withBuildTarget(value: string | undefined, action: () => void): void {
  const previous = process.env.SANDUQKIN_BUILD_TARGET;
  if (value === undefined) delete process.env.SANDUQKIN_BUILD_TARGET;
  else process.env.SANDUQKIN_BUILD_TARGET = value;
  try { action(); } finally {
    if (previous === undefined) delete process.env.SANDUQKIN_BUILD_TARGET;
    else process.env.SANDUQKIN_BUILD_TARGET = previous;
  }
}
function routerRoot(plugins: (string | [string, Record<string, unknown>])[]): unknown {
  const router = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-router");
  return Array.isArray(router) ? router[1].root : undefined;
}
