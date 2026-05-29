import { describe, expect, it } from "vitest";

import { createBackupCodesViewModel } from "./backup-codes-view-model";

describe("createBackupCodesViewModel", () => {
  it("returns backup codes placeholder with 6 codes and acknowledgment copy", () => {
    const viewModel = createBackupCodesViewModel();

    expect(viewModel.codes).toHaveLength(6);
    expect(viewModel.codes[0]).toBe("ABCD-1234-EFGH");
    expect(viewModel.acknowledgmentLabel).toBe(
      "I have saved these codes in a safe place.",
    );
    expect(viewModel.primaryActionLabel).toBe(
      "Continue to code verification",
    );
    expect(viewModel.title).toBe("Save your backup codes");
  });
});
