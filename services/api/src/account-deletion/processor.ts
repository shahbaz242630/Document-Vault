export type AccountDeletionRequest = {
  attempt_count?: number;
  id: string;
  scheduled_for: string;
  status: "pending";
  user_id: string;
};

export type AccountDeletionProcessorSummary = {
  completed: number;
  failed: number;
  selected: number;
};

export type AccountDeletionProcessorClient = {
  deleteAuthUser: (userId: string, shouldSoftDelete: boolean) => Promise<void>;
  markCompleted: (requestId: string, completedAt?: string) => Promise<void>;
  markFailed: (requestId: string, errorMessage: string) => Promise<void>;
  markProcessing: (requestId: string, nextAttemptCount?: number) => Promise<void>;
  selectDueRequests: (input: {
    limit: number;
    scheduledBefore: string;
  }) => Promise<AccountDeletionRequest[]>;
};

export async function processDueAccountDeletionRequests({
  client,
  limit = 25,
  now = new Date(),
}: {
  client: AccountDeletionProcessorClient;
  limit?: number;
  now?: Date;
}): Promise<AccountDeletionProcessorSummary> {
  const scheduledBefore = now.toISOString();
  const requests = await client.selectDueRequests({ limit, scheduledBefore });
  const summary: AccountDeletionProcessorSummary = {
    completed: 0,
    failed: 0,
    selected: requests.length,
  };

  for (const request of requests) {
    try {
      await client.markProcessing(request.id, (request.attempt_count ?? 0) + 1);
      await client.deleteAuthUser(request.user_id, true);
      await client.markCompleted(request.id, scheduledBefore);
      summary.completed += 1;
    } catch (error) {
      await client.markFailed(request.id, error instanceof Error ? error.message : "Unknown error");
      summary.failed += 1;
    }
  }

  return summary;
}
