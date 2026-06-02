import type { AccountDeletionRequestRepository } from "./supabase-account-deletion-request-repository";

type SupabaseSessionResult = {
  data: {
    session: {
      access_token: string;
    } | null;
  };
  error: { message?: string } | null;
};

export type ApiAccountDeletionRequestRepositoryDeps = {
  apiBaseUrl: string;
  fetch?: typeof fetch;
  supabaseAuth: {
    getSession: () => Promise<SupabaseSessionResult>;
  };
};

export function createApiAccountDeletionRequestRepository({
  apiBaseUrl,
  fetch: fetchImpl = fetch,
  supabaseAuth,
}: ApiAccountDeletionRequestRepositoryDeps): AccountDeletionRequestRepository {
  return {
    async requestDeletion(): Promise<void> {
      const sessionResult = await supabaseAuth.getSession();
      const accessToken = sessionResult.data.session?.access_token;

      if (sessionResult.error || !accessToken) {
        throw new Error(sessionResult.error?.message ?? "Account deletion requires an active session.");
      }

      const response = await fetchImpl(`${apiBaseUrl.replace(/\/$/, "")}/account-deletion/request`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Account deletion request could not be saved.");
      }
    },
  };
}
