import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "./proxy";

describe("protected claimant host proxy", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("conceals the claimant application while disabled", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLAIMANT_WEB_AUTHENTICATION_ENABLED", "false");
    const response = await proxy(new NextRequest("https://app.synthetic.test/claimant/sign-in"));
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  });

  it("permits only the exact claimant hostname when enabled for tests", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("CLAIMANT_WEB_AUTHENTICATION_ENABLED", "true");
    vi.stubEnv("CLAIMANT_WEB_ALLOWED_HOSTS", "app.synthetic.test");

    const claimant = await proxy(new NextRequest("https://app.synthetic.test/claimant/sign-in"));
    expect(claimant.status).toBe(200);
    expect(claimant.headers.get("Cache-Control")).toBe("private, no-store");
    expect(claimant.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");

    for (const host of ["sanduqkin.com", "vault.sanduqkin.com", "evil.app.synthetic.test"]) {
      const denied = await proxy(new NextRequest(`https://${host}/claimant/sign-in`));
      expect(denied.status).toBe(404);
    }
  });
});
