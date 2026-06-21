import { describe, expect, it } from "vitest";

import { readBearerToken, timingSafeStringEqual } from "./http";

describe("HTTP security helpers", () => {
  it("extracts bearer tokens and rejects malformed schemes", () => {
    expect(readBearerToken("Bearer session-token")).toBe("session-token");
    expect(readBearerToken(" bearer   session-token  ")).toBe("session-token");
    expect(readBearerToken("Basic session-token")).toBeNull();
    expect(readBearerToken(undefined)).toBeNull();
  });

  it("compares secrets without accepting prefixes or suffixes", () => {
    expect(timingSafeStringEqual("processor-token", "processor-token")).toBe(true);
    expect(timingSafeStringEqual("processor-token ", "processor-token")).toBe(false);
    expect(timingSafeStringEqual("processor", "processor-token")).toBe(false);
    expect(timingSafeStringEqual(undefined, "processor-token")).toBe(false);
  });
});

