import { describe, expect, it } from "vitest";

import { createApiAccountDeletionRequestRepository } from "./api-account-deletion-request-repository";

describe("api account deletion request repository", () => {
  it("posts the authenticated deletion request to the API", async () => {
    const calls: unknown[] = [];
    const repository = createApiAccountDeletionRequestRepository({
      apiBaseUrl: "https://sanduqkin-api.example",
      fetch: async (url, init) => {
        calls.push({ init, url });

        return { ok: true } as Response;
      },
      supabaseAuth: {
        async getSession() {
          return {
            data: {
              session: {
                access_token: "session-token",
              },
            },
            error: null,
          };
        },
      },
    });

    await repository.requestDeletion();

    expect(calls).toEqual([
      {
        init: {
          headers: {
            Authorization: "Bearer session-token",
          },
          method: "POST",
        },
        url: "https://sanduqkin-api.example/account-deletion/request",
      },
    ]);
  });
});
