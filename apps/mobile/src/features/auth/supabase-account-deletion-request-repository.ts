type SupabaseError = {
  message?: string;
};

type SupabaseResult<T> = {
  data: T;
  error: SupabaseError | null;
};

type AccountDeletionRequestRowInsert = {
  status: "pending";
};

type AccountDeletionRequestsTable = {
  insert: (values: AccountDeletionRequestRowInsert) => Promise<SupabaseResult<null>>;
};

export type SupabaseAccountDeletionRequestClient = {
  from: (table: "account_deletion_requests") => AccountDeletionRequestsTable;
};

export type AccountDeletionRequestRepository = {
  requestDeletion: () => Promise<void>;
};

export function createSupabaseAccountDeletionRequestRepository(
  client: SupabaseAccountDeletionRequestClient,
): AccountDeletionRequestRepository {
  const table = client.from("account_deletion_requests");

  return {
    async requestDeletion(): Promise<void> {
      const result = await table.insert({
        status: "pending",
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Account deletion request could not be saved.");
      }
    },
  };
}
