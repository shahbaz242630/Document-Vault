import { createClient } from "@supabase/supabase-js";
import type { Context } from "hono";

import { isRequestBodyTooLarge, readBearerToken } from "../security/http.js";

const MAX_ACCOUNT_DELETION_REQUEST_BODY_BYTES = 1024;

type AccountDeletionRequestConfig = {
  appBaseUrl: string;
  emailFrom: string;
  resendApiKey?: string;
  serviceRoleKey: string;
  supabaseUrl: string;
};

type AccountDeletionRequestRow = {
  id: string;
  scheduledFor: string;
};

type AccountDeletionRequestUser = {
  email: string;
  id: string;
};

type AccountDeletionRequestClient = {
  createRequest: (userId: string) => Promise<AccountDeletionRequestRow>;
  getUser: (jwt: string) => Promise<AccountDeletionRequestUser>;
};

type AccountDeletionConfirmationEmail = {
  from: string;
  scheduledFor: string;
  to: string;
};

type AccountDeletionEmailSender = {
  send: (input: AccountDeletionConfirmationEmail) => Promise<void>;
};

type RouteDeps = {
  createClient?: (config: AccountDeletionRequestConfig) => AccountDeletionRequestClient;
  emailSender?: AccountDeletionEmailSender;
  getConfig?: () => AccountDeletionRequestConfig | null;
};

export function createAccountDeletionRequestRoute(deps: RouteDeps = {}) {
  return async (context: Context) => {
    if (isRequestBodyTooLarge(context, MAX_ACCOUNT_DELETION_REQUEST_BODY_BYTES)) {
      return context.json({ error: "Payload too large" }, 413);
    }

    const jwt = readBearerToken(context.req.header("Authorization"));
    if (!jwt) {
      return context.json({ error: "Unauthorized" }, 401);
    }

    const config = (deps.getConfig ?? getAccountDeletionRequestConfig)();
    if (!config) {
      return context.json({ error: "Account deletion request is not configured" }, 503);
    }

    const client = (deps.createClient ?? createSupabaseAccountDeletionRequestClient)(config);
    const emailSender = deps.emailSender ?? createResendAccountDeletionEmailSender(config);
    let user: AccountDeletionRequestUser;
    try {
      user = await client.getUser(jwt);
    } catch {
      return context.json({ error: "Unauthorized" }, 401);
    }

    const request = await client.createRequest(user.id);

    await emailSender.send({
      from: config.emailFrom,
      scheduledFor: request.scheduledFor,
      to: user.email,
    });

    return context.json({ ok: true, scheduledFor: request.scheduledFor }, 200);
  };
}

function getAccountDeletionRequestConfig(): AccountDeletionRequestConfig | null {
  const appBaseUrl = process.env.ACCOUNT_DELETION_APP_BASE_URL?.trim();
  const emailFrom = process.env.ACCOUNT_DELETION_EMAIL_FROM?.trim();
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const supabaseUrl = process.env.SUPABASE_URL?.trim();

  if (!appBaseUrl || !emailFrom || !resendApiKey || !serviceRoleKey || !supabaseUrl) {
    return null;
  }

  return { appBaseUrl, emailFrom, resendApiKey, serviceRoleKey, supabaseUrl };
}

function createSupabaseAccountDeletionRequestClient(
  config: AccountDeletionRequestConfig,
): AccountDeletionRequestClient {
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return {
    async createRequest(userId) {
      const result = await supabase
        .from("account_deletion_requests")
        .insert({ status: "pending", user_id: userId })
        .select("id,scheduled_for")
        .single();

      if (result.error) {
        throw new Error(result.error.message ?? "Account deletion request could not be saved.");
      }

      return {
        id: String(result.data.id),
        scheduledFor: String(result.data.scheduled_for),
      };
    },

    async getUser(jwt) {
      const result = await supabase.auth.getUser(jwt);
      if (result.error || !result.data.user?.email) {
        throw new Error(result.error?.message ?? "Authenticated user could not be loaded.");
      }

      return {
        email: result.data.user.email,
        id: result.data.user.id,
      };
    },
  };
}

function createResendAccountDeletionEmailSender(
  config: AccountDeletionRequestConfig,
): AccountDeletionEmailSender {
  return {
    async send(input) {
      const response = await fetch("https://api.resend.com/emails", {
        body: JSON.stringify({
          from: input.from,
          html: renderAccountDeletionConfirmationHtml(input.scheduledFor),
          subject: "Sanduqkin account deletion scheduled",
          text: renderAccountDeletionConfirmationText(input.scheduledFor),
          to: input.to,
        }),
        headers: {
          Authorization: `Bearer ${config.resendApiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Account deletion confirmation email could not be sent.");
      }
    },
  };
}

function renderAccountDeletionConfirmationText(scheduledFor: string): string {
  return [
    "Your Sanduqkin account deletion request has been scheduled.",
    `Your encrypted vault data and wrapped key material are scheduled for deletion on ${scheduledFor}.`,
    "If you did not request this, contact Sanduqkin support immediately.",
  ].join("\n\n");
}

function renderAccountDeletionConfirmationHtml(scheduledFor: string): string {
  return [
    "<p>Your Sanduqkin account deletion request has been scheduled.</p>",
    `<p>Your encrypted vault data and wrapped key material are scheduled for deletion on ${scheduledFor}.</p>`,
    "<p>If you did not request this, contact Sanduqkin support immediately.</p>",
  ].join("");
}
