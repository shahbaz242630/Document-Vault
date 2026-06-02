import { describe, expect, it } from "vitest";

import { getApiEnv } from "./api-env";

describe("getApiEnv", () => {
  it("reports API as unconfigured when the public URL is missing", () => {
    expect(getApiEnv({})).toEqual({ isConfigured: false });
  });

  it("returns the trimmed public API URL when configured", () => {
    expect(
      getApiEnv({
        EXPO_PUBLIC_API_URL: " https://sanduqkin-api.example ",
      }),
    ).toEqual({
      isConfigured: true,
      url: "https://sanduqkin-api.example",
    });
  });
});
