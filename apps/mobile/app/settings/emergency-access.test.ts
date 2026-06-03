import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Emergency access settings route", () => {
  it("renders the emergency access setup shell", () => {
    const source = readFileSync(resolve(__dirname, "emergency-access.tsx"), "utf8");

    expect(source).toContain("EmergencyAccessScreen");
    expect(source).toContain('title: "Emergency access"');
  });
});
