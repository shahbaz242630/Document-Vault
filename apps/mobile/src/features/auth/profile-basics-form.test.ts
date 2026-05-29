import { describe, expect, it } from "vitest";

import { createProfileBasics } from "./profile-basics-form";

describe("createProfileBasics", () => {
  it("builds a profile basics record from valid form values", () => {
    const profile = createProfileBasics({
      country: "UAE",
      firstName: "John",
      nationality: "British",
    });

    expect(profile).toEqual({
      country: "UAE",
      firstName: "John",
      nationality: "British",
    });
  });

  it("trims whitespace from form values", () => {
    const profile = createProfileBasics({
      country: " UAE ",
      firstName: " John ",
      nationality: " British ",
    });

    expect(profile).toEqual({
      country: "UAE",
      firstName: "John",
      nationality: "British",
    });
  });

  it("rejects empty required fields", () => {
    expect(() =>
      createProfileBasics({
        country: "",
        firstName: "",
        nationality: "",
      }),
    ).toThrow();
  });
});
