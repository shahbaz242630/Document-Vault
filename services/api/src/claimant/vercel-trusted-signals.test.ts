import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createVercelTrustedSignals } from "./vercel-trusted-signals.js";

async function signalFor(headers: Record<string, string>, env: Record<string, string | undefined> = { VERCEL: "1" }) {
  const app = new Hono();
  app.get("/", async (context) => context.json(await createVercelTrustedSignals(env)(context)));
  return (await app.request("https://api.sanduqkin.test/", { headers })).json();
}

describe("Vercel trusted network signal (W1)", () => {
  it("uses only Vercel's own client address header", async () => {
    expect(await signalFor({ "x-vercel-forwarded-for": "203.0.113.7" })).toEqual({ networkSignal: "203.0.113.7" });
    expect(await signalFor({ "x-vercel-forwarded-for": "2001:db8::1" })).toEqual({ networkSignal: "2001:db8::1" });
  });

  it("ignores client-controlled forwarding headers", async () => {
    expect(await signalFor({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "203.0.113.7",
      "cf-connecting-ip": "203.0.113.7", "true-client-ip": "203.0.113.7" })).toBeNull();
  });

  it("refuses anything that is not one IP address", async () => {
    for (const value of ["", "203.0.113.7, 198.51.100.2", "not-an-ip", "203.0.113.7:443", "a".repeat(64)]) {
      expect(await signalFor({ "x-vercel-forwarded-for": value })).toBeNull();
    }
  });

  it("returns nothing off Vercel, where no edge vouches for the header", async () => {
    for (const env of [{}, { VERCEL: "0" }, { VERCEL: "true" }]) {
      expect(await signalFor({ "x-vercel-forwarded-for": "203.0.113.7" }, env)).toBeNull();
    }
  });
});
