import { describe, expect, it } from "vitest";

import { getSupabaseEnv } from "./supabase-env";

describe("getSupabaseEnv", () => {
  it("reports Supabase as unconfigured when public values are missing", () => {
    const result = getSupabaseEnv({});

    expect(result).toEqual({ isConfigured: false });
  });

  it("returns trimmed public Supabase values when configured", () => {
    const result = getSupabaseEnv({
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " publishable-key ",
      EXPO_PUBLIC_SUPABASE_URL: " https://example.supabase.co ",
    });

    expect(result).toEqual({
      isConfigured: true,
      publishableKey: "publishable-key",
      url: "https://example.supabase.co",
    });
  });

  it("refuses service role values in the mobile environment", () => {
    expect(() =>
      getSupabaseEnv({
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "service-role-secret",
        EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow("Mobile Supabase config must never include service role keys.");
  });
});
