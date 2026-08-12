import { describe, expect, it } from "vitest";

import { createProtectedWebSecurityHeaders } from "./security-headers";

describe("protected web security headers", () => {
  it("builds a nonce-based production policy for the vault and login", () => {
    const headers = createProtectedWebSecurityHeaders({
      nonce: "test-nonce",
      secureRequest: true,
      supabaseUrl: "https://example.supabase.co",
    });

    expect(headers).toMatchObject({
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    });
    expect(headers["Content-Security-Policy"]).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(headers["Content-Security-Policy"]).toContain("connect-src 'self' https://example.supabase.co wss://example.supabase.co");
    expect(headers["Content-Security-Policy"]).toContain("worker-src 'self' blob:");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy"]).toContain("upgrade-insecure-requests");
  });

  it("keeps local Supabase and workers usable without forcing HTTPS", () => {
    const headers = createProtectedWebSecurityHeaders({
      nonce: "local-nonce",
      secureRequest: false,
      supabaseUrl: "http://localhost:54321",
    });

    expect(headers).not.toHaveProperty("Strict-Transport-Security");
    expect(headers["Content-Security-Policy"]).toContain("connect-src 'self' http://localhost:54321 ws://localhost:54321");
    expect(headers["Content-Security-Policy"]).not.toContain("upgrade-insecure-requests");
  });
});
