import { describe, expect, it } from "vitest";

import { createProfileBasicsViewModel } from "./profile-basics-view-model";

describe("createProfileBasicsViewModel", () => {
  it("returns ordered fields for the profile basics form", () => {
    const viewModel = createProfileBasicsViewModel();

    expect(viewModel.fields.map((field) => field.name)).toEqual([
      "firstName",
      "country",
      "nationality",
    ]);
  });

  it("marks all fields as required", () => {
    const viewModel = createProfileBasicsViewModel();

    expect(viewModel.fields.every((field) => field.required)).toBe(true);
  });
});
