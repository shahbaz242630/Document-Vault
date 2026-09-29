import { describe, expect, it, vi } from "vitest";

import { withClaimantPreviewBypass } from "./claimant-preview-fetch";

const secret = "Abcdefghijklmnop0123456789_-xyz";

describe("claimant Preview API bypass (W2a)", () => {
  it("adds the bypass header only in the Preview build with a well-formed value", async () => {
    const send = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}"));
    await withClaimantPreviewBypass(send, { preview: true, bypass: secret })("https://api.test/x",
      { method: "POST", headers: { Origin: "https://owner.test" } });
    const headers = new Headers(send.mock.calls[0]![1]!.headers);
    expect(headers.get("x-vercel-protection-bypass")).toBe(secret);
    expect(headers.get("origin")).toBe("https://owner.test");
  });

  it("returns the original fetch untouched outside the Preview build or without a valid value", () => {
    const send = vi.fn(async () => new Response("{}"));
    expect(withClaimantPreviewBypass(send, { preview: false, bypass: secret })).toBe(send);
    for (const bypass of [undefined, "", " ", "short", "has spaces in it at all", `${"a".repeat(129)}`, "semi;colon0123456789"])
      expect(withClaimantPreviewBypass(send, { preview: true, bypass })).toBe(send);
    expect(withClaimantPreviewBypass(send)).toBe(send);
  });
});
