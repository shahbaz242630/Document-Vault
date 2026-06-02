export type AuditRetentionProcessorSummary = {
  deleted: number;
};

export type AuditRetentionProcessorClient = {
  deleteAnonymizedBefore: (occurredBefore: string) => Promise<number>;
};

export async function processExpiredAnonymizedAuditEvents({
  client,
  now = new Date(),
}: {
  client: AuditRetentionProcessorClient;
  now?: Date;
}): Promise<AuditRetentionProcessorSummary> {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 7);

  const deleted = await client.deleteAnonymizedBefore(cutoff.toISOString());

  return { deleted };
}
