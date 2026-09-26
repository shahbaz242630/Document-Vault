import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { isClaimantPreviewBuild } from "./claimant-preview-build";

const mobileRoot = resolve(__dirname, "../../..");
const nodeRequire = createRequire(import.meta.url);
const configFactory = nodeRequire(resolve(mobileRoot, "app.config.js")) as () => {
  name: string; scheme: string; android: { package: string }; ios: { bundleIdentifier: string };
  extra: { claimantPreviewBuild: boolean };
};

function withEnv(values: Record<string, string | undefined>, action: () => void): void {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const apply = (entries: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
  apply(values);
  try { action(); } finally { apply(previous); }
}

describe("claimant Preview build gate (W2a)", () => {
  it("opens only when the inlined switch and the Preview app marker agree", () => {
    expect(isClaimantPreviewBuild({ flag: "synthetic-only", extra: { claimantPreviewBuild: true } })).toBe(true);
    for (const signals of [
      { flag: undefined, extra: { claimantPreviewBuild: true } },
      { flag: "synthetic-only", extra: { claimantPreviewBuild: false } },
      { flag: "synthetic-only", extra: undefined },
      { flag: "true", extra: { claimantPreviewBuild: true } },
      { flag: "SYNTHETIC-ONLY", extra: { claimantPreviewBuild: true } },
      { flag: "synthetic-only", extra: { claimantPreviewBuild: "true" } },
    ]) expect(isClaimantPreviewBuild(signals)).toBe(false);
    expect(isClaimantPreviewBuild()).toBe(false);
  });

  it("gives the Preview app its own identity and leaves the real app unchanged", () => {
    withEnv({ SANDUQKIN_BUILD_TARGET: undefined, EXPO_PUBLIC_CLAIMANT_PREVIEW_BUILD: undefined }, () => {
      expect(configFactory()).toMatchObject({ name: "Sanduqkin", scheme: "sanduqkin",
        android: { package: "com.sanduqkin.mobile" }, ios: { bundleIdentifier: "com.sanduqkin.mobile" },
        extra: { claimantPreviewBuild: false } });
    });
    withEnv({ SANDUQKIN_BUILD_TARGET: "claimant_preview", EXPO_PUBLIC_CLAIMANT_PREVIEW_BUILD: "synthetic-only" }, () => {
      expect(configFactory()).toMatchObject({ name: "Sanduqkin Preview", scheme: "sanduqkin-claimant-preview",
        android: { package: "com.sanduqkin.mobile.claimantpreview" },
        ios: { bundleIdentifier: "com.sanduqkin.mobile.claimantpreview" }, extra: { claimantPreviewBuild: true } });
    });
  });

  it("refuses the switch outside the Preview app and the Preview app under the production profile", () => {
    for (const target of [undefined, "claimant_offline_code_kdf_probe"]) {
      withEnv({ SANDUQKIN_BUILD_TARGET: target, EXPO_PUBLIC_CLAIMANT_PREVIEW_BUILD: "synthetic-only" }, () => {
        expect(() => configFactory()).toThrow("only allowed in the claimant_preview build");
      });
    }
    withEnv({ SANDUQKIN_BUILD_TARGET: "claimant_preview", EAS_BUILD_PROFILE: "production" }, () => {
      expect(() => configFactory()).toThrow("cannot use the production EAS profile");
    });
  });

  it("defines one internal EAS profile that carries the switch and no secret", () => {
    const eas = JSON.parse(readFileSync(resolve(mobileRoot, "eas.json"), "utf8")) as {
      build: Record<string, { env?: Record<string, string> }>;
    };
    const profile = eas.build["claimant-preview"]!;
    expect(profile).toMatchObject({ developmentClient: false, distribution: "internal", environment: "preview",
      android: { buildType: "apk" }, ios: { credentialsSource: "remote", simulator: false } });
    expect(Object.keys(profile.env ?? {}).sort()).toEqual(["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_CLAIMANT_PREVIEW_BUILD",
      "EXPO_PUBLIC_OFFLINE_CODE_V2_CLAIMANT_ORIGIN", "EXPO_PUBLIC_OFFLINE_CODE_V2_OWNER_ORIGIN",
      "SANDUQKIN_BUILD_TARGET"]);
    for (const [name, other] of Object.entries(eas.build)) {
      if (name !== "claimant-preview") expect(JSON.stringify(other)).not.toContain("CLAIMANT_PREVIEW_BUILD");
    }
  });
});
