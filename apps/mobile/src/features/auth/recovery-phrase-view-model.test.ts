import { describe, expect, it } from "vitest";

import { createRecoveryPhraseViewModel } from "./recovery-phrase-view-model";

describe("createRecoveryPhraseViewModel", () => {
  it("returns recovery phrase placeholder copy", () => {
    const viewModel = createRecoveryPhraseViewModel();

    expect(viewModel.title).toBe("Save your recovery phrase");
    expect(viewModel.primaryActionLabel).toBe("I have written it down");
    expect(viewModel.warning).toContain("Sanduqkin cannot recover your data");
  });
});
