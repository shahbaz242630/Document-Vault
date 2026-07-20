import { describe, expect, it } from "vitest";

import { getWebSupabaseConfig } from "./config";

describe("web Supabase configuration", () => {
  it("stays disabled unless both public values exist", () => {
    expect(getWebSupabaseConfig({})).toBeNull();
    expect(getWebSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" })).toBeNull();
  });

  it("accepts only a publishable browser key and HTTPS project URL", () => {
    expect(getWebSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/",
    })).toEqual({ publishableKey: "sb_publishable_test", url: "https://example.supabase.co" });
  });

  it("rejects insecure remote project URLs", () => {
    expect(() => getWebSupabaseConfig({
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      NEXT_PUBLIC_SUPABASE_URL: "http://example.supabase.co",
    })).toThrow("must use HTTPS");
  });
});
