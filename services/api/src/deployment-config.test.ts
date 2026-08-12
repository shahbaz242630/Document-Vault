import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

type VercelConfig = {
  regions?: unknown;
};

describe("Vercel deployment configuration", () => {
  it("runs the API beside the Frankfurt Supabase primary", async () => {
    const config = JSON.parse(
      await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
    ) as VercelConfig;

    expect(config.regions).toEqual(["fra1"]);
  });

  it("publishes the shared workspace contract with separate runtime and type entries", async () => {
    const manifest = JSON.parse(
      await readFile(new URL("../../../packages/shared-types/package.json", import.meta.url), "utf8"),
    ) as Readonly<{ main?: unknown; types?: unknown }>;

    expect(manifest).toMatchObject({ main: "dist/index.js", types: "src/index.ts" });
  });
});
