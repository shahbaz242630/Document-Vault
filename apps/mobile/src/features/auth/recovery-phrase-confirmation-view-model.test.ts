import { describe, expect, it } from "vitest";

import { createRecoveryPhraseConfirmationViewModel } from "./recovery-phrase-confirmation-view-model";

describe("createRecoveryPhraseConfirmationViewModel", () => {
  it("returns confirmation placeholder copy", () => {
    const viewModel = createRecoveryPhraseConfirmationViewModel();

    expect(viewModel.title).toBe("A quick check");
    expect(viewModel.primaryActionLabel).toBe("Confirm");
    expect(viewModel.successMessage).toContain("Recovery phrase confirmed");
  });
});
