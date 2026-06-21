import { describe, expect, it } from "vitest";

import { lastFourDigitsSchema } from "./index";

describe("lastFourDigitsSchema", () => {
  it("accepts exactly four ASCII digits", () => {
    expect(lastFourDigitsSchema.parse("0000")).toBe("0000");
    expect(lastFourDigitsSchema.parse("1234")).toBe("1234");
    expect(lastFourDigitsSchema.parse("9999")).toBe("9999");
  });

  it.each([
    ["too short", "123"],
    ["too long", "12345"],
    ["letters", "12a4"],
    ["leading whitespace", " 1234"],
    ["trailing whitespace", "1234 "],
    ["punctuation", "12-4"],
    ["non-ASCII digits", "١٢٣٤"],
    ["number value", 1234],
    ["null value", null],
  ])("rejects %s", (_label, value) => {
    expect(lastFourDigitsSchema.safeParse(value).success).toBe(false);
  });
});
