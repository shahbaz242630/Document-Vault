import { describe, expect, it } from "vitest";

import {
  generateEmergencyAccessCode,
  normalizeEmergencyAccessCode,
} from "./emergency-access-code";

describe("emergency access code", () => {
  it("generates a high-entropy grouped code", async () => {
    const code = await generateEmergencyAccessCode();

    expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/);
    expect(code.replaceAll("-", "")).toHaveLength(20);
  });

  it("normalizes lower-case and spaced code input", () => {
    expect(normalizeEmergencyAccessCode(" k7q9 m2xd 8v4p zr6t al3n ")).toBe(
      "K7Q9-M2XD-8V4P-ZR6T-AL3N",
    );
  });

  it("rejects malformed emergency codes", () => {
    expect(() => normalizeEmergencyAccessCode("1234")).toThrow(
      "Emergency access code is invalid.",
    );
  });
});
