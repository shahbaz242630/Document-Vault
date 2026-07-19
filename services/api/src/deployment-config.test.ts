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
});
