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
});
