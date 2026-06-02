import type { Context } from "hono";

import { processExpiredAnonymizedAuditEvents } from "./processor.js";
import {
  createServiceRoleSupabaseClient,
  createSupabaseAuditRetentionProcessorClient,
} from "./supabase-retention-client.js";
import type { AuditRetentionProcessorSummary } from "./processor.js";

type AuditRetentionProcessorConfig = {
  processorToken: string;
  serviceRoleKey: string;
  supabaseUrl: string;
};

type RouteDeps = {
  getConfig?: () => AuditRetentionProcessorConfig | null;
  processExpiredEvents?: (input: {
    serviceRoleKey: string;
    supabaseUrl: string;
  }) => Promise<AuditRetentionProcessorSummary>;
};

export function createAuditRetentionProcessorRoute(deps: RouteDeps = {}) {
  return async (context: Context) => {
    const config = (deps.getConfig ?? getAuditRetentionProcessorConfig)();

    if (!config) {
      return context.json({ error: "Audit retention processor is not configured" }, 503);
    }

    if (context.req.header("Authorization")?.trim() !== `Bearer ${config.processorToken}`) {
      return context.json({ error: "Unauthorized" }, 401);
    }

    const processExpiredEvents = deps.processExpiredEvents ?? runSupabaseProcessor;
    const summary = await processExpiredEvents({
      serviceRoleKey: config.serviceRoleKey,
      supabaseUrl: config.supabaseUrl,
    });

    return context.json({ ok: true, ...summary }, 200);
  };
}

function getAuditRetentionProcessorConfig(): AuditRetentionProcessorConfig | null {
  const processorToken = process.env.AUDIT_RETENTION_PROCESSOR_TOKEN?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();

  if (!processorToken || !serviceRoleKey || !supabaseUrl) {
    return null;
  }

  return { processorToken, serviceRoleKey, supabaseUrl };
}

async function runSupabaseProcessor({
  serviceRoleKey,
  supabaseUrl,
}: {
  serviceRoleKey: string;
  supabaseUrl: string;
}): Promise<AuditRetentionProcessorSummary> {
  const supabase = createServiceRoleSupabaseClient({ serviceRoleKey, supabaseUrl });
  const client = createSupabaseAuditRetentionProcessorClient(supabase);

  return processExpiredAnonymizedAuditEvents({ client });
}
