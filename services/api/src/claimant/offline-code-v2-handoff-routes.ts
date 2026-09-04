import { createClient } from "@supabase/supabase-js";
import type { Context } from "hono";

import {
  createOfflineCodeV2HandoffController,
  createOfflineCodeV2HandoffPreflightController,
} from "./offline-code-v2-handoff-controller.js";
import { createOfflineCodeV2HandoffService } from "./offline-code-v2-handoff-service.js";
import { createOfflineCodeV2HandoffTransactionClient } from
  "./offline-code-v2-handoff-transaction-client.js";
import { createClaimantPortalSessionClient, type ClaimantPortalSessionClient } from
  "./portal-session-client.js";
import type { RegisteredRecipientSupabaseConfig } from "./registered-recipient-client.js";
import {
  ClaimantCapabilityDisabledError,
  getClaimantRuntimeConfig,
  requireClaimantCapability,
  type ClaimantRuntimeConfig,
} from "./runtime-config.js";

export const CLAIMANT_OFFLINE_CODE_V2_HANDOFF_ROUTES_APPROVED = false as const;

export type OfflineCodeV2HandoffRouteConfig = RegisteredRecipientSupabaseConfig & Readonly<{
  apiOrigin: string;
  claimantOrigin: string;
}>;

type Transaction = ReturnType<typeof createOfflineCodeV2HandoffTransactionClient>;
type Deps = Readonly<{
  approved?: boolean;
  createPortalClient?: (config: RegisteredRecipientSupabaseConfig) => ClaimantPortalSessionClient;
  createTransactionClient?: (config: RegisteredRecipientSupabaseConfig) => Transaction;
  getConfig?: () => OfflineCodeV2HandoffRouteConfig | null;
  now?: () => number;
  runtimeConfig?: ClaimantRuntimeConfig;
}>;

export function createOfflineCodeV2HandoffRoute(
  action: "issue" | "complete",
  deps: Deps = {},
) {
  return async (context: Context): Promise<Response> => {
    const prepared = prepare(context, deps);
    if (prepared instanceof Response) return prepared;
    return createOfflineCodeV2HandoffController(action, {
      approved: true,
      config: prepared.config,
      createService: () => createOfflineCodeV2HandoffService({
        approved: true,
        now: deps.now,
        portal: (deps.createPortalClient ?? createClaimantPortalSessionClient)(prepared.config),
        transaction: (deps.createTransactionClient ?? createTransactionClient)(prepared.config),
      }),
      runtimeConfig: prepared.runtimeConfig,
    })(context);
  };
}

export function createOfflineCodeV2HandoffPreflightRoute(deps: Deps = {}) {
  return (context: Context): Response => {
    const prepared = prepare(context, deps);
    if (prepared instanceof Response) return prepared;
    return createOfflineCodeV2HandoffPreflightController({
      approved: true,
      config: prepared.config,
      runtimeConfig: prepared.runtimeConfig,
    })(context);
  };
}

type Prepared = Readonly<{
  config: OfflineCodeV2HandoffRouteConfig;
  runtimeConfig: ClaimantRuntimeConfig;
}>;

function prepare(context: Context, deps: Deps): Prepared | Response {
  if (!(deps.approved ?? CLAIMANT_OFFLINE_CODE_V2_HANDOFF_ROUTES_APPROVED)) return concealed(context);
  const runtimeConfig = deps.runtimeConfig ?? getClaimantRuntimeConfig();
  try {
    requireClaimantCapability(runtimeConfig, "offlineCodeV2");
  } catch (error) {
    if (error instanceof ClaimantCapabilityDisabledError) return concealed(context);
    throw error;
  }
  const config = (deps.getConfig ?? getOfflineCodeV2HandoffRouteConfig)();
  if (!config) return concealed(context);
  return { config, runtimeConfig };
}

function createTransactionClient(config: RegisteredRecipientSupabaseConfig): Transaction {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  return createOfflineCodeV2HandoffTransactionClient((name, input) => supabase.rpc(name, input));
}

export function getOfflineCodeV2HandoffRouteConfig(
  env: Record<string, string | undefined> = process.env,
): OfflineCodeV2HandoffRouteConfig | null {
  const apiOrigin = exactHttpsOrigin(env.OFFLINE_CODE_V2_API_ORIGIN);
  const claimantOrigin = exactHttpsOrigin(env.OFFLINE_CODE_V2_CLAIMANT_ORIGIN);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = exactHttpsOrigin(env.SUPABASE_URL);
  if (!apiOrigin || !claimantOrigin || apiOrigin === claimantOrigin || !serviceRoleKey || !supabaseUrl) {
    return null;
  }
  return { apiOrigin, claimantOrigin, serviceRoleKey, supabaseUrl };
}

function exactHttpsOrigin(value: string | undefined): string | null {
  try {
    if (!value || value !== value.trim()) return null;
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.origin === value && parsed.pathname === "/"
      && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
      ? parsed.origin : null;
  } catch {
    return null;
  }
}

function concealed(context: Context): Response {
  return context.json({ error: "Not found" }, 404);
}
