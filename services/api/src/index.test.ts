import { describe, expect, it } from "vitest";

import { app, claimantRuntimeConfig } from "./index";

describe("API health route", () => {
  it("prevents caching and cross-origin embedding of the health response", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("starts disabled and conceals the mounted claimant mutation boundary", async () => {
    expect(claimantRuntimeConfig.masterEnabled).toBe(false);
    expect(Object.values(claimantRuntimeConfig.effective).every((enabled) => !enabled)).toBe(true);

    const issue = await app.request("/claimant/registered-recipient/invitations", {
      method: "POST",
    });
    const accept = await app.request(
      "/claimant/registered-recipient/invitations/30000000-0000-4000-8000-000000000003/accept",
      { method: "POST" },
    );
    const preflight = await app.request("/claimant/registered-recipient/invitations", {
      method: "OPTIONS",
    });
    const activate = await app.request("/claimant/session/activate", { method: "POST" });
    const revoke = await app.request("/claimant/session/revoke", { method: "POST" });
    const nativeEnrollment = await app.request("/claimant/native-enrollment/challenges", { method: "POST" });

    expect(issue.status).toBe(404);
    expect(accept.status).toBe(404);
    expect(preflight.status).toBe(404);
    expect(activate.status).toBe(404);
    expect(revoke.status).toBe(404);
    expect(nativeEnrollment.status).toBe(404);
    expect(issue.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
