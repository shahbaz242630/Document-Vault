import { describe, expect, it } from "vitest";

import { app } from "./index";

describe("API health route", () => {
  it("prevents caching and cross-origin embedding of the health response", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
