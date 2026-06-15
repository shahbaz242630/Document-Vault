import type { Context } from "hono";

import { isRequestBodyTooLarge, readBearerToken, timingSafeStringEqual } from "../security/http.js";
import { processDueAccountDeletionRequests } from "./processor.js";
import {
  createServiceRoleSupabaseClient,
  createSupabaseAccountDeletionProcessorClient,
} from "./supabase-processor-client.js";
import type { AccountDeletionProcessorSummary } from "./processor.js";

const MAX_INTERNAL_PROCESSOR_BODY_BYTES = 1024;

type AccountDeletionProcessorConfig = {
  processorToken: string;
  serviceRoleKey: string;
  supabaseUrl: string;
};

type RouteDeps = {
  getConfig?: () => AccountDeletionProcessorConfig | null;
  processDueRequests?: (input: {
    serviceRoleKey: string;
    supabaseUrl: string;
  }) => Promise<AccountDeletionProcessorSummary>;
};

export function createAccountDeletionProcessorRoute(deps: RouteDeps = {}) {
  return async (context: Context) => {
    if (isRequestBodyTooLarge(context, MAX_INTERNAL_PROCESSOR_BODY_BYTES)) {
      return context.json({ error: "Payload too large" }, 413);
    }

    const config = (deps.getConfig ?? getAccountDeletionProcessorConfig)();

    if (!config) {
      return context.json({ error: "Account deletion processor is not configured" }, 503);
    }

    const token = readBearerToken(context.req.header("Authorization"));
    if (!timingSafeStringEqual(token ?? undefined, config.processorToken)) {
      return context.json({ error: "Unauthorized" }, 401);
    }

    const processDueRequests = deps.processDueRequests ?? runSupabaseProcessor;
    const summary = await processDueRequests({
      serviceRoleKey: config.serviceRoleKey,
      supabaseUrl: config.supabaseUrl,
    });

    return context.json({ ok: true, ...summary }, 200);
  };
}

function getAccountDeletionProcessorConfig(): AccountDeletionProcessorConfig | null {
  const processorToken = process.env.ACCOUNT_DELETION_PROCESSOR_TOKEN?.trim();
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
}): Promise<AccountDeletionProcessorSummary> {
  const supabase = createServiceRoleSupabaseClient({ serviceRoleKey, supabaseUrl });
  const client = createSupabaseAccountDeletionProcessorClient(supabase);

  return processDueAccountDeletionRequests({ client });
}
