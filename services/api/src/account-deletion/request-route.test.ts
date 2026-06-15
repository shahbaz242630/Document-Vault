import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { createAccountDeletionRequestRoute } from "./request-route";

describe("account deletion request route", () => {
  it("rejects unauthenticated requests before requiring email configuration", async () => {
    const app = new Hono();
    app.post(
      "/account-deletion/request",
      createAccountDeletionRequestRoute({
        getConfig: () => null,
      }),
    );

    const response = await app.request("/account-deletion/request", {
      method: "POST",
    });

    expect(response.status).toBe(401);
  });

  it("rejects requests without a bearer token", async () => {
    const app = new Hono();
    app.post(
      "/account-deletion/request",
      createAccountDeletionRequestRoute({
        getConfig: () => ({
          appBaseUrl: "https://sanduqkin.example",
          emailFrom: "Sanduqkin <support@sanduqkin.example>",
          serviceRoleKey: "service-role",
          supabaseUrl: "https://project.supabase.co",
        }),
      }),
    );

    const response = await app.request("/account-deletion/request", {
      method: "POST",
    });

    expect(response.status).toBe(401);
  });

  it("rejects oversized request bodies before touching Supabase or email services", async () => {
    const calls: unknown[] = [];
    const app = new Hono();
    app.post(
      "/account-deletion/request",
      createAccountDeletionRequestRoute({
        getConfig: () => {
          calls.push({ method: "getConfig" });

          return {
            appBaseUrl: "https://sanduqkin.example",
            emailFrom: "Sanduqkin <support@sanduqkin.example>",
            serviceRoleKey: "service-role",
            supabaseUrl: "https://project.supabase.co",
          };
        },
      }),
    );

    const response = await app.request("/account-deletion/request", {
      body: "x",
      headers: {
        Authorization: "Bearer session-token",
        "Content-Length": "1025",
      },
      method: "POST",
    });

    await expect(response.json()).resolves.toEqual({ error: "Payload too large" });
    expect(response.status).toBe(413);
    expect(calls).toEqual([]);
  });

  it("rejects malformed authorization schemes", async () => {
    const calls: unknown[] = [];
    const app = new Hono();
    app.post(
      "/account-deletion/request",
      createAccountDeletionRequestRoute({
        getConfig: () => ({
          appBaseUrl: "https://sanduqkin.example",
          emailFrom: "Sanduqkin <support@sanduqkin.example>",
          serviceRoleKey: "service-role",
          supabaseUrl: "https://project.supabase.co",
        }),
        createClient: () => ({
          async createRequest(userId) {
            calls.push({ method: "createRequest", userId });
            throw new Error("should not create request");
          },
          async getUser(jwt) {
            calls.push({ jwt, method: "getUser" });
            throw new Error("should not load user");
          },
        }),
      }),
    );

    const response = await app.request("/account-deletion/request", {
      headers: { Authorization: "Basic session-token" },
      method: "POST",
    });

    expect(response.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("returns 401 instead of leaking auth client errors for invalid bearer tokens", async () => {
    const app = new Hono();
    app.post(
      "/account-deletion/request",
      createAccountDeletionRequestRoute({
        getConfig: () => ({
          appBaseUrl: "https://sanduqkin.example",
          emailFrom: "Sanduqkin <support@sanduqkin.example>",
          serviceRoleKey: "service-role",
          supabaseUrl: "https://project.supabase.co",
        }),
        createClient: () => ({
          async createRequest() {
            throw new Error("should not create request");
          },
          async getUser() {
            throw new Error("invalid JWT");
          },
        }),
      }),
    );

    const response = await app.request("/account-deletion/request", {
      headers: { Authorization: "Bearer invalid-token" },
      method: "POST",
    });

    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(response.status).toBe(401);
  });

  it("queues a deletion request and sends a confirmation email for an authenticated user", async () => {
    const calls: unknown[] = [];
    const app = new Hono();
    app.post(
      "/account-deletion/request",
      createAccountDeletionRequestRoute({
        getConfig: () => ({
          appBaseUrl: "https://sanduqkin.example",
          emailFrom: "Sanduqkin <support@sanduqkin.example>",
          serviceRoleKey: "service-role",
          supabaseUrl: "https://project.supabase.co",
        }),
        createClient: () => ({
          async createRequest(userId) {
            calls.push({ method: "createRequest", userId });

            return {
              id: "request-1",
              scheduledFor: "2026-07-02T12:00:00.000Z",
            };
          },
          async getUser(jwt) {
            calls.push({ jwt, method: "getUser" });

            return {
              email: "partner@example.com",
              id: "user-1",
            };
          },
        }),
        emailSender: {
          async send(input) {
            calls.push({ method: "sendEmail", ...input });
          },
        },
      }),
    );

    const response = await app.request("/account-deletion/request", {
      headers: { Authorization: "Bearer session-token" },
      method: "POST",
    });

    await expect(response.json()).resolves.toEqual({
      ok: true,
      scheduledFor: "2026-07-02T12:00:00.000Z",
    });
    expect(response.status).toBe(200);
    expect(calls).toEqual([
      { jwt: "session-token", method: "getUser" },
      { method: "createRequest", userId: "user-1" },
      {
        from: "Sanduqkin <support@sanduqkin.example>",
        method: "sendEmail",
        scheduledFor: "2026-07-02T12:00:00.000Z",
        to: "partner@example.com",
      },
    ]);
  });
});
