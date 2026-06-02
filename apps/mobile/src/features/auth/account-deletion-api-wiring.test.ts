import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const mobileRoot = resolve(__dirname, "../../..");

describe("account deletion API wiring", () => {
  it("uses the API-backed deletion request repository so confirmation email is server-side", () => {
    const source = readFileSync(
      resolve(mobileRoot, "src/features/auth/components/account-deletion-panel.tsx"),
      "utf8",
    );

    expect(source).toContain("createApiAccountDeletionRequestRepository");
    expect(source).toContain("getApiEnv()");
    expect(source).not.toContain("createSupabaseAccountDeletionRequestRepository");
  });
});
