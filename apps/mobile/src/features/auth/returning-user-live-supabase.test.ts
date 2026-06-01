import { describe, expect, it } from "vitest";

import { deriveKEK, generateSalt } from "@/shared/crypto/kek-derivation";
import { unwrapMEK, wrapMEK } from "@/shared/crypto/mek-wrapping";
import {
  fromBase64,
  generateMasterEncryptionKey,
  toBase64,
} from "@/shared/crypto/vault-crypto";
import {
  createSupabaseKeyMaterialRepository,
  type SupabaseKeyMaterialClient,
} from "@/features/vault/supabase-key-material-repository";
import {
  createSupabaseVaultRepository,
  type SupabaseVaultClient,
} from "@/features/vault/supabase-vault-repository";
import { createVaultSession } from "@/features/vault/vault-session";

import { unlockReturningUserVault } from "./returning-user-unlock-flow";

const runLive = process.env.RUN_LIVE_SUPABASE_RETURNING_USER === "1";
const describeLive = runLive ? describe : describe.skip;

const KEY_MATERIAL_COLUMNS =
  "wrapped_mek_ciphertext, wrapped_mek_nonce, kek_salt, kdf_algorithm, kdf_params, recovery_version";
const VAULT_ASSET_COLUMNS =
  "id, asset_type, ciphertext, nonce, created_at, updated_at, deleted_at";

describeLive("live Supabase returning-user vault unlock", () => {
  it(
    "persists wrapped MEK and encrypted assets, then unlocks them after password sign-in",
    async () => {
      const client = createLiveSupabaseRestClient();
      const configuredEmail = process.env.LIVE_SUPABASE_TEST_EMAIL?.trim();
      const configuredPassword = process.env.LIVE_SUPABASE_TEST_PASSWORD?.trim();

      if (configuredEmail && !configuredPassword) {
        throw new Error("LIVE_SUPABASE_TEST_PASSWORD is required with LIVE_SUPABASE_TEST_EMAIL.");
      }

      const email = configuredEmail ?? `codex-returning-user-${Date.now()}@example.com`;
      const password = configuredPassword ?? `Codex live ${Date.now()} password`;
      const assetTitle = `Live encrypted contact ${Date.now()}`;
      const savedAssetIds: string[] = [];

      try {
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
            "Supabase did not return a session. Disable email confirmation or provide LIVE_SUPABASE_TEST_EMAIL and LIVE_SUPABASE_TEST_PASSWORD for a verified test account.",
          );
        }

        const mek = await generateMasterEncryptionKey();
        const salt = await generateSalt();
        const kek = await deriveKEK(password, salt);
        const keyMaterialRepository = createSupabaseKeyMaterialRepository(client);

        await keyMaterialRepository.saveKeyMaterial({
          kdfAlgorithm: "argon2id",
          kdfParams: {
            keyLength: 32,
            memlimit: 268435456,
            opslimit: 3,
          },
          kekSalt: salt,
          recoveryVersion: 1,
          wrappedMek: await wrapMEK(mek, kek),
        });

        const firstSession = createVaultSession({
          key: mek,
          repository: createSupabaseVaultRepository(client),
        });
        const createdAsset = await firstSession.addAsset({
          assetType: "contact",
          fields: {
            country: "UAE",
            name: "Live verification contact",
          },
          notes: "This plaintext must not be stored in Supabase.",
          title: assetTitle,
        });
        savedAssetIds.push(createdAsset.id);

        await client.auth.signOut();

        const signInResult = await client.auth.signInWithPassword({ email, password });

        if (signInResult.error) {
          throw new Error(`Supabase sign-in failed: ${signInResult.error.message}`);
        }

        const returning = {
          session: null as ReturnType<typeof createVaultSession> | null,
        };
        const mekStorage = { set: async (_base64: string) => undefined };

        await unlockReturningUserVault({
          deriveKEK,
          initializeVault: async (keyBase64) => {
            returning.session = createVaultSession({
              key: await fromBase64(keyBase64),
              repository: createSupabaseVaultRepository(client),
            });
            await returning.session.loadPersistedAssets();
          },
          keyMaterialRepository: createSupabaseKeyMaterialRepository(client),
          mekStorage,
          password,
          toBase64,
          unwrapMEK,
        });

        if (!returning.session) {
          throw new Error("Returning vault session was not initialized.");
        }

        const activeAssets = await returning.session.listActiveAssets();

        expect(activeAssets).toEqual([
          {
            assetType: "contact",
            fields: {
              country: "UAE",
              name: "Live verification contact",
            },
            id: createdAsset.id,
            notes: "This plaintext must not be stored in Supabase.",
            title: assetTitle,
          },
        ]);

        const rawRows = await client.selectVaultAssetCiphertext(createdAsset.id);

        expect(JSON.stringify(rawRows)).not.toContain(assetTitle);
        expect(JSON.stringify(rawRows)).not.toContain("Live verification contact");
      } finally {
        await cleanupLiveRows(client, savedAssetIds);
      }
    },
    60_000,
  );
});

type AuthResponse = {
  data: { session: { access_token: string } | null };
  error: { message: string } | null;
};

type LiveSupabaseRestClient = SupabaseKeyMaterialClient &
  SupabaseVaultClient & {
    auth: {
      signInWithPassword: (credentials: {
        email: string;
        password: string;
      }) => Promise<AuthResponse>;
      signOut: () => Promise<void>;
      signUp: (credentials: { email: string; password: string }) => Promise<AuthResponse>;
    };
    selectVaultAssetCiphertext: (
      id: string,
    ) => Promise<Array<{ asset_type: string; ciphertext: string; nonce: string }>>;
  };

function createLiveSupabaseRestClient(): LiveSupabaseRestClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  let accessToken: string | null = null;

  if (!url || !publishableKey) {
    throw new Error("Supabase env is not configured for live verification.");
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

  async function authRequest(
    path: string,
    body: { email: string; password: string },
  ): Promise<AuthResponse> {
    try {
      const data = await request<{
        access_token?: string;
        session?: { access_token: string };
      }>(path, {
        body,
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

  function selectRows<T>(table: string, columns: string, query = ""): Promise<T[]> {
    return request<T[]>(
      `/rest/v1/${table}?select=${encodeURIComponent(columns)}${query}`,
    );
  }

  function upsertRow<T>(table: string, values: unknown, columns: string): Promise<T> {
    const conflictColumn = table === "vault_assets" ? "id" : "user_id";

    return request<T[]>(
      `/rest/v1/${table}?on_conflict=${conflictColumn}&select=${encodeURIComponent(columns)}`,
      {
        body: values,
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        method: "POST",
      },
    ).then((rows) => rows[0] as T);
  }

  const client = {
    auth: {
      signInWithPassword(credentials: { email: string; password: string }) {
        return authRequest("/auth/v1/token?grant_type=password", credentials);
      },
      async signOut() {
        accessToken = null;
      },
      signUp(credentials: { email: string; password: string }) {
        return authRequest("/auth/v1/signup", credentials);
      },
    },
    from(table: "vault_key_material" | "vault_assets") {
      if (table === "vault_key_material") {
        return {
          select(columns: typeof KEY_MATERIAL_COLUMNS) {
            return {
              async maybeSingle() {
                const rows = await selectRows(table, columns);

                return { data: rows[0] ?? null, error: null };
              },
            };
          },
          upsert(values: unknown) {
            return {
              select(columns: typeof KEY_MATERIAL_COLUMNS) {
                return {
                  async single() {
                    return {
                      data: await upsertRow(table, values, columns),
                      error: null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      return {
        delete() {
          return {
            eq(_column: "id", value: string) {
              return {
                select(_columns: "id") {
                  return {
                    async maybeSingle() {
                      const rows = await request<Array<{ id: string }>>(
                        `/rest/v1/vault_assets?id=eq.${encodeURIComponent(value)}&select=id`,
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
        select(columns: typeof VAULT_ASSET_COLUMNS) {
          return {
            async order(_column: "created_at", _options: { ascending: true }) {
              return {
                data: await selectRows(
                  "vault_assets",
                  columns,
                  "&order=created_at.asc",
                ),
                error: null,
              };
            },
          };
        },
        update(values: unknown) {
          return {
            eq(_column: "id", value: string) {
              return {
                select(columns: typeof VAULT_ASSET_COLUMNS) {
                  return {
                    async maybeSingle() {
                      const rows = await request<unknown[]>(
                        `/rest/v1/vault_assets?id=eq.${encodeURIComponent(value)}&select=${encodeURIComponent(columns)}`,
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
        upsert(values: unknown) {
          return {
            select(columns: typeof VAULT_ASSET_COLUMNS) {
              return {
                async single() {
                  return {
                    data: await upsertRow("vault_assets", values, columns),
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
    selectVaultAssetCiphertext(id: string) {
      return selectRows(
        "vault_assets",
        "asset_type,ciphertext,nonce",
        `&id=eq.${encodeURIComponent(id)}`,
      );
    },
  };

  return client as LiveSupabaseRestClient;
}

async function cleanupLiveRows(client: LiveSupabaseRestClient, assetIds: string[]) {
  for (const assetId of assetIds) {
    await client.from("vault_assets").delete().eq("id", assetId).select("id").maybeSingle();
  }

  await client.auth.signOut();
}
