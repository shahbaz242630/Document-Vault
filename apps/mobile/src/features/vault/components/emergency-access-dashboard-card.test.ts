import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("EmergencyAccessDashboardCard", () => {
  it("renders the readiness state as the primary card heading", () => {
    const source = readFileSync(
      resolve(__dirname, "emergency-access-dashboard-card.tsx"),
      "utf8",
    );
    const labelPosition = source.indexOf("{label}");
    const titlePosition = source.indexOf("Vault emergency access");

    expect(labelPosition).toBeGreaterThan(-1);
    expect(titlePosition).toBeGreaterThan(-1);
    expect(labelPosition).toBeLessThan(titlePosition);
    expect(source).toContain("fontSize: 19");
  });
});
