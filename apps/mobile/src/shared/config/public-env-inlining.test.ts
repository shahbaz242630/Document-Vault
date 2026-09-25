import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getApiEnv } from "./api-env";
import { getRevenueCatEnv } from "./revenuecat-env";

/*
 * Expo inlines public values only where code reads the literal `process.env.EXPO_PUBLIC_*`. A dynamic lookup is
 * left untouched and is empty at runtime in release builds, which silently unconfigured the API URL, RevenueCat
 * and SSL pinning. These tests run Expo's own production transform over each reader.
 */
// Expo's own Babel (a dependency of babel-preset-expo), loaded untyped so no new package is needed.
const load = createRequire(__filename);
const { transformSync } = load("@babel/core") as {
  transformSync(code: string, options: Record<string, unknown>): { code?: string | null } | null;
};

const values: Record<string, string> = {
  EXPO_PUBLIC_API_URL: "https://api.inlined.test",
  EXPO_PUBLIC_REVENUECAT_API_KEY: "rc_shared_inlined",
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: "rc_ios_inlined",
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: "rc_android_inlined",
  EXPO_PUBLIC_SUPABASE_PIN_PRIMARY: "pin_primary_inlined",
  EXPO_PUBLIC_SUPABASE_PIN_BACKUP: "pin_backup_inlined",
};
const readers: Record<string, readonly string[]> = {
  "api-env.ts": ["EXPO_PUBLIC_API_URL"],
  "revenuecat-env.ts": ["EXPO_PUBLIC_REVENUECAT_API_KEY", "EXPO_PUBLIC_REVENUECAT_IOS_KEY",
    "EXPO_PUBLIC_REVENUECAT_ANDROID_KEY"],
  "../security/ssl-pinning.ts": ["EXPO_PUBLIC_SUPABASE_PIN_PRIMARY", "EXPO_PUBLIC_SUPABASE_PIN_BACKUP"],
};

afterEach(() => { vi.unstubAllEnvs(); });

describe("public environment inlining for release builds", () => {
  it("inlines every public value each reader needs under Expo's production transform", () => {
    for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
    for (const [file, keys] of Object.entries(readers)) {
      const filename = resolve(__dirname, file);
      const output = transformSync(readFileSync(filename, "utf8"), { filename, babelrc: false, configFile: false,
        presets: [load.resolve("babel-preset-expo")],
        caller: { name: "metro", bundler: "metro", platform: "ios", isDev: false, isServer: false } as never })?.code;
      for (const key of keys) {
        expect(output, `${file} ${key}`).toContain(JSON.stringify(values[key]));
      }
    }
  });

  it("reads the runtime environment by default and uses an injected environment as is", () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", " https://api.runtime.test ");
    vi.stubEnv("EXPO_PUBLIC_REVENUECAT_IOS_KEY", "rc_ios_runtime");
    expect(getApiEnv()).toEqual({ isConfigured: true, url: "https://api.runtime.test" });
    expect(getApiEnv(process.env)).toEqual({ isConfigured: true, url: "https://api.runtime.test" });
    expect(getApiEnv({})).toEqual({ isConfigured: false });
    expect(getRevenueCatEnv(process.env)).toMatchObject({ isConfigured: true, iosKey: "rc_ios_runtime" });
    expect(getRevenueCatEnv({})).toEqual({ isConfigured: false });
  });
});
