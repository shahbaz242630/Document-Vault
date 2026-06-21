import { describe, expect, it } from "vitest";

import { createSupabaseClient } from "./supabase-client";

describe("createSupabaseClient", () => {
  it("returns null until Supabase public config exists", () => {
    const client = createSupabaseClient({}, () => ({ connected: true }));

    expect(client).toBeNull();
  });

  it("creates a client with public Supabase values", () => {
    const calls: Array<[string, string]> = [];

    const client = createSupabaseClient(
      {
        EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        EXPO_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      },
      (url, key) => {
        calls.push([url, key]);
        return { connected: true };
      },
    );

    expect(client).toEqual({ connected: true });
    expect(calls).toEqual([["https://example.supabase.co", "publishable-key"]]);
  });

  it("reuses the default app client so auth session survives route changes", () => {
    const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";

    try {
      expect(createSupabaseClient()).toBe(createSupabaseClient());
    } finally {
      restoreEnv("EXPO_PUBLIC_SUPABASE_URL", originalUrl);
      restoreEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", originalKey);
    }
  });
});

function restoreEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
