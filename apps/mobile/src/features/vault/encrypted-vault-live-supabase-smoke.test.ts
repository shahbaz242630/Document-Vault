import { describe, expect, it } from "vitest";

import { generateMasterEncryptionKey } from "@/shared/crypto/vault-crypto";

import type { AssetType } from "./asset-payload";
import { createSupabaseVaultRepository } from "./supabase-vault-repository";
import { createVaultSession } from "./vault-session";

const runLive = process.env.RUN_LIVE_SUPABASE_ENCRYPTION_SMOKE === "1";
const describeLive = runLive ? describe : describe.skip;

const RAW_VAULT_ASSET_COLUMNS =
  "id, user_id, asset_type, ciphertext, nonce, created_at, updated_at, deleted_at";

describeLive("live Supabase encrypted vault storage smoke", () => {
  it(
    "stores asset details as ciphertext in Supabase vault_assets",
    async () => {
      const client = createSmokeSupabaseRestClient();
      const testId = Date.now();
      const configuredEmail = process.env.LIVE_SUPABASE_TEST_EMAIL?.trim();
      const configuredPassword = process.env.LIVE_SUPABASE_TEST_PASSWORD?.trim();
      const email = configuredEmail ?? `codex-vault-smoke-${testId}@gmail.com`;
      const password = configuredPassword ?? `Codex smoke ${testId} password`;
      const plaintextSentinels = {
        accountNumber: `SMOKE-ACCOUNT-${testId}`,
        issuer: `Smoke Raw Bank ${testId}`,
        notes: `Smoke raw notes ${testId}`,
        title: `Smoke Raw Card ${testId}`,
      };

      const savedAssetIds: string[] = [];

      try {
        if (configuredEmail && !configuredPassword) {
          throw new Error("LIVE_SUPABASE_TEST_PASSWORD is required with LIVE_SUPABASE_TEST_EMAIL.");
        }

        const signUpResult = configuredEmail
          ? await client.auth.signInWithPassword({ email, password })
          : await client.auth.signUp({ email, password });

        if (signUpResult.error) {
          throw new Error(
            `Supabase ${configuredEmail ? "sign-in" : "sign-up"} failed: ${signUpResult.error.message}`,
          );
        }

        if (!signUpResult.data.session) {
          throw new Error(
            "Supabase did not return a session. Disable email confirmation for smoke tests or use a verified test account path.",
          );
        }

        const session = createVaultSession({
          key: await generateMasterEncryptionKey(),
          repository: createSupabaseVaultRepository(client),
        });

        const createdAsset = await session.addAsset({
          assetType: "card",
          fields: {
            accountNumber: plaintextSentinels.accountNumber,
            issuer: plaintextSentinels.issuer,
            last4: "4242",
          },
          notes: plaintextSentinels.notes,
          title: plaintextSentinels.title,
        });

        savedAssetIds.push(createdAsset.id);

        const [rawRow] = await client.selectVaultAssetRaw(createdAsset.id);

        expect(rawRow).toBeDefined();
        expect(rawRow.asset_type).toBe("card");
        expect(rawRow.ciphertext).toMatch(/^[A-Za-z0-9_-]+={0,2}$/);
        expect(rawRow.nonce).toMatch(/^[A-Za-z0-9_-]+={0,2}$/);
        expect(rawRow.ciphertext.length).toBeGreaterThan(80);
        expect(rawRow.nonce.length).toBeGreaterThan(20);

        const rawJson = JSON.stringify(rawRow);

        expect(rawJson).not.toContain(plaintextSentinels.title);
        expect(rawJson).not.toContain(plaintextSentinels.issuer);
        expect(rawJson).not.toContain(plaintextSentinels.accountNumber);
        expect(rawJson).not.toContain(plaintextSentinels.notes);

        console.info("Live encrypted vault smoke row summary", {
          assetType: rawRow.asset_type,
          ciphertextLength: rawRow.ciphertext.length,
          deletedAt: rawRow.deleted_at,
          hasAccountNumberPlaintext: rawJson.includes(plaintextSentinels.accountNumber),
          hasIssuerPlaintext: rawJson.includes(plaintextSentinels.issuer),
          hasNotesPlaintext: rawJson.includes(plaintextSentinels.notes),
          hasTitlePlaintext: rawJson.includes(plaintextSentinels.title),
          nonceLength: rawRow.nonce.length,
          rawColumns: Object.keys(rawRow),
        });
      } finally {
        for (const assetId of savedAssetIds) {
          await client.from("vault_assets").delete().eq("id", assetId).select("id").maybeSingle();
        }

        await client.auth.signOut();
      }
    },
    60_000,
  );
});

type AuthResponse = {
  data: { session: { access_token: string } | null };
  error: { message: string } | null;
};

type SmokeVaultAssetRow = {
  asset_type: AssetType;
  ciphertext: string;
  created_at: string;
  deleted_at: string | null;
  id: string;
  nonce: string;
  updated_at: string;
  user_id: string;
};

type SupabaseResult<T> = {
  data: T;
  error: { message?: string } | null;
};

type SmokeSupabaseRestClient = {
  auth: {
    signOut: () => Promise<void>;
    signInWithPassword: (credentials: {
      email: string;
      password: string;
    }) => Promise<AuthResponse>;
    signUp: (credentials: { email: string; password: string }) => Promise<AuthResponse>;
  };
  from: (table: "vault_assets") => {
    delete: () => {
      eq: (column: "id", value: string) => {
        select: (columns: "id") => {
          maybeSingle: () => Promise<SupabaseResult<{ id: string } | null>>;
        };
      };
    };
    select: (columns: string) => {
      order: (
        column: "created_at",
        options: { ascending: true },
      ) => Promise<SupabaseResult<SmokeVaultAssetRow[]>>;
    };
    update: (values: { deleted_at: string | null; updated_at: string }) => {
      eq: (column: "id", value: string) => {
        select: (columns: string) => {
          maybeSingle: () => Promise<SupabaseResult<SmokeVaultAssetRow | null>>;
        };
      };
    };
    upsert: (
      values: {
        asset_type: string;
        ciphertext: string;
        created_at: string;
        deleted_at: string | null;
        id?: string;
        nonce: string;
        updated_at: string;
      },
      options: { onConflict: "id" },
    ) => {
      select: (columns: string) => {
        single: () => Promise<SupabaseResult<SmokeVaultAssetRow>>;
      };
    };
  };
  selectVaultAssetRaw: (id: string) => Promise<SmokeVaultAssetRow[]>;
};

function createSmokeSupabaseRestClient(): SmokeSupabaseRestClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  let accessToken: string | null = null;

  if (!url || !publishableKey) {
    throw new Error("Supabase env is not configured for live smoke verification.");
  }
  const supabaseUrl = url;
  const supabaseKey = publishableKey;

  async function request<T>(
    path: string,
    options: {
      body?: unknown;
      headers?: Record<string, string>;
      method?: string;
    } = {},
  ): Promise<T> {
    const response = await fetch(`${supabaseUrl}${path}`, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken ?? supabaseKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
      method: options.method ?? "GET",
    });
    const text = await response.text();
    const data = text.length > 0 ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(
        data?.message ??
          data?.msg ??
          data?.error_description ??
          data?.error ??
          response.statusText,
      );
    }

    return data as T;
  }

  function selectRows<T>(table: string, columns: string, query = ""): Promise<T[]> {
    return request<T[]>(`/rest/v1/${table}?select=${encodeURIComponent(columns)}${query}`);
  }

  function upsertRow<T>(table: string, values: unknown, columns: string): Promise<T> {
    return request<T[]>(
      `/rest/v1/${table}?on_conflict=id&select=${encodeURIComponent(columns)}`,
      {
        body: values,
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        method: "POST",
      },
    ).then((rows) => rows[0] as T);
  }

  return {
    auth: {
      async signOut() {
        accessToken = null;
      },
      async signInWithPassword(credentials: { email: string; password: string }) {
        return authRequest("/auth/v1/token?grant_type=password", credentials);
      },
      async signUp(credentials: { email: string; password: string }) {
        return authRequest("/auth/v1/signup", credentials);
      },
    },
    from(table: "vault_assets") {
      return {
        delete() {
          return {
            eq(_column: "id", value: string) {
              return {
                select(_columns: "id") {
                  return {
                    async maybeSingle() {
                      const rows = await request<Array<{ id: string }>>(
                        `/rest/v1/${table}?id=eq.${encodeURIComponent(value)}&select=id`,
                        {
                          headers: { Prefer: "return=representation" },
                          method: "DELETE",
                        },
                      );

                      return { data: rows[0] ?? null, error: null };
                    },
                  };
                },
              };
            },
          };
        },
        select(columns: string) {
          return {
            async order(_column: "created_at", _options: { ascending: true }) {
              return {
                data: await selectRows<SmokeVaultAssetRow>(
                  table,
                  columns,
                  "&order=created_at.asc",
                ),
                error: null,
              };
            },
          };
        },
        update(values: { deleted_at: string | null; updated_at: string }) {
          return {
            eq(_column: "id", value: string) {
              return {
                select(columns: string) {
                  return {
                    async maybeSingle() {
                      const rows = await request<SmokeVaultAssetRow[]>(
                        `/rest/v1/${table}?id=eq.${encodeURIComponent(value)}&select=${encodeURIComponent(columns)}`,
                        {
                          body: values,
                          headers: { Prefer: "return=representation" },
                          method: "PATCH",
                        },
                      );

                      return { data: rows[0] ?? null, error: null };
                    },
                  };
                },
              };
            },
          };
        },
        upsert(values: unknown, _options: { onConflict: "id" }) {
          return {
            select(columns: string) {
              return {
                async single() {
                  return {
                    data: await upsertRow<SmokeVaultAssetRow>(table, values, columns),
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
    selectVaultAssetRaw(id: string) {
      return selectRows<SmokeVaultAssetRow>(
        "vault_assets",
        RAW_VAULT_ASSET_COLUMNS,
        `&id=eq.${encodeURIComponent(id)}`,
      );
    },
  };

  async function authRequest(
    path: string,
    credentials: { email: string; password: string },
  ): Promise<AuthResponse> {
    try {
      const data = await request<{
        access_token?: string;
        session?: { access_token: string };
      }>(path, {
        body: credentials,
        method: "POST",
      });
      const token = data.session?.access_token ?? data.access_token ?? null;

      accessToken = token;

      return {
        data: { session: token ? { access_token: token } : null },
        error: null,
      };
    } catch (error) {
      return {
        data: { session: null },
        error: { message: error instanceof Error ? error.message : "Auth failed." },
      };
    }
  }
}
