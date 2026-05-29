import { describe, expect, it } from "vitest";

import { createAccountDeletionViewModel } from "./account-deletion-view-model";

describe("createAccountDeletionViewModel", () => {
  it("returns deletion screen copy", () => {
    const vm = createAccountDeletionViewModel();

    expect(vm.title).toBe("Delete account");
    expect(vm.warningTitle).toBe("This is irreversible");
    expect(vm.dangerActionLabel).toBe("Permanently delete account");
    expect(vm.confirmationInputLabel).toBe("Type DELETE to confirm");
  });
});
