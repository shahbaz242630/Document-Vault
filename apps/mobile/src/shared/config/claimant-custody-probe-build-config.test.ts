import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const repositoryRoot = resolve(__dirname, "../../../../..");
const mobileRoot = resolve(repositoryRoot, "apps/mobile");
const nodeRequire = createRequire(import.meta.url);
const configFactory = nodeRequire(resolve(mobileRoot, "app.config.js")) as () => {
  name: string;
  slug: string;
  scheme: string;
  ios: {
    bundleIdentifier: string;
    deploymentTarget: string;
    entitlements?: Record<string, string>;
    infoPlist: { ITSAppUsesNonExemptEncryption: boolean };
  };
  plugins: (string | [string, Record<string, unknown>])[];
  extra: {
    claimantAppAttestProbeBuild: boolean;
    claimantCustodyProbeBuild: boolean;
    claimantIsolatedProbeBuild: boolean;
  };
};

describe("claimant custody probe build isolation", () => {
  it("keeps the ordinary app on its normal router and bundle identifier", () => {
    withBuildTarget(undefined, () => {
      const config = configFactory();
      expect(config.name).toBe("Sanduqkin");
      expect(config.ios.bundleIdentifier).toBe("com.sanduqkin.mobile");
      expect(config.ios.infoPlist.ITSAppUsesNonExemptEncryption).toBe(false);
      expect(routerRoot(config.plugins)).toBe("./app");
      expect(config.extra.claimantCustodyProbeBuild).toBe(false);
      expect(config.extra.claimantAppAttestProbeBuild).toBe(false);
      expect(config.ios.entitlements).toBeUndefined();
    });
  });

  it("uses an iOS 27 development App Attest entitlement only in the isolated adapter profile", () => {
    withBuildTarget("claimant_app_attest_probe", () => {
      const config = configFactory();
      expect(config).toMatchObject({
        name: "Sanduqkin App Attest Probe",
        scheme: "sanduqkin-claimant-app-attest-probe",
        ios: {
          bundleIdentifier: "com.sanduqkin.mobile.claimantappattestprobe",
          deploymentTarget: "27.0",
          entitlements: { "com.apple.developer.devicecheck.appattest-environment": "development" },
        },
        extra: { claimantAppAttestProbeBuild: true, claimantIsolatedProbeBuild: true },
      });
      expect(routerRoot(config.plugins)).toBe("./app-attest-probe-app");
    });
  });

  it("uses a separate app identity and router root only for the probe profile", () => {
    withBuildTarget("claimant_custody_probe", () => {
      const config = configFactory();
      expect(config).toMatchObject({
        name: "Sanduqkin Custody Probe",
        scheme: "sanduqkin-claimant-custody-probe",
        slug: "sanduqkin",
        ios: { bundleIdentifier: "com.sanduqkin.mobile.claimantprobe" },
        extra: { claimantCustodyProbeBuild: true },
      });
      expect(routerRoot(config.plugins)).toBe("./probe-app");
    });
  });

  it("defines a non-production internal iOS EAS profile with no Supabase configuration", () => {
    const eas = JSON.parse(readFileSync(resolve(mobileRoot, "eas.json"), "utf8")) as {
      build: Record<string, unknown>;
    };
    expect(eas.build["claimant-custody-probe"]).toEqual({
      developmentClient: false,
      distribution: "internal",
      environment: "preview",
      env: { SANDUQKIN_BUILD_TARGET: "claimant_custody_probe" },
      ios: { credentialsSource: "remote", simulator: false },
    });
    expect(eas.build["claimant-app-attest-probe"]).toEqual({
      developmentClient: false,
      distribution: "internal",
      environment: "preview",
      env: { SANDUQKIN_BUILD_TARGET: "claimant_app_attest_probe" },
      ios: { credentialsSource: "remote", simulator: false },
    });
    const probeSource = readFileSync(resolve(mobileRoot, "probe-app/index.tsx"), "utf8");
    expect(probeSource).not.toMatch(/from\s+["'][^"']*(supabase|revenuecat)|fetch\(|axios/iu);
  });
});

function withBuildTarget(value: string | undefined, action: () => void): void {
  const previous = process.env.SANDUQKIN_BUILD_TARGET;
  if (value === undefined) delete process.env.SANDUQKIN_BUILD_TARGET;
  else process.env.SANDUQKIN_BUILD_TARGET = value;
  try {
    action();
  } finally {
    if (previous === undefined) delete process.env.SANDUQKIN_BUILD_TARGET;
    else process.env.SANDUQKIN_BUILD_TARGET = previous;
  }
}

function routerRoot(plugins: (string | [string, Record<string, unknown>])[]): unknown {
  const router = plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-router");
  return Array.isArray(router) ? router[1].root : undefined;
}
