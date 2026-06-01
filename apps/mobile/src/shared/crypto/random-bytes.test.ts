import { describe, expect, it } from "vitest";

import { generateRandomBytes } from "./random-bytes";

describe("generateRandomBytes", () => {
  it("returns the requested number of secure random bytes", async () => {
    const random = await generateRandomBytes(16);

    expect(random).toBeInstanceOf(Uint8Array);
    expect(random).toHaveLength(16);
  });
});
