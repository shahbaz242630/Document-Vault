import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

describe("web deployment configuration", () => {
  it("does not disclose the framework signature header", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("serves the static brand icon for conventional favicon requests", async () => {
    await expect(nextConfig.rewrites?.()).resolves.toEqual([
      { source: "/favicon.ico", destination: "/favicon.svg" },
    ]);
  });

  it("publishes only a value-free static health signal", () => {
    const healthPath = fileURLToPath(new URL("../public/health.json", import.meta.url));
    const health = JSON.parse(readFileSync(healthPath, "utf8"));

    expect(health).toEqual({
      ok: true,
      service: "sanduqkin-web",
      mode: "static",
    });
  });

  it("keeps the web workspace available to Git-driven Vercel builds", () => {
    const ignorePath = fileURLToPath(new URL("../../../.vercelignore", import.meta.url));
    const ignoredPaths = readFileSync(ignorePath, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));

    expect(ignoredPaths).not.toContain("apps");
    expect(ignoredPaths).not.toContain("apps/web");
  });
});
