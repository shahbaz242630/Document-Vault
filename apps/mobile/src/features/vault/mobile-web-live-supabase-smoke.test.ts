import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { unlockReturningUserVault } from "@/features/auth/returning-user-unlock-flow";
import { deriveKEK } from "@/shared/crypto/kek-derivation";
import { unwrapMEK } from "@/shared/crypto/mek-wrapping";
import { fromBase64, toBase64 } from "@/shared/crypto/vault-crypto";

import {
  createSupabaseKeyMaterialRepository,
  type SupabaseKeyMaterialClient,
} from "./supabase-key-material-repository";
import {
  createSupabaseVaultRepository,
  type SupabaseVaultClient,
} from "./supabase-vault-repository";
import { createVaultSession, type VaultSession } from "./vault-session";

const action = process.env.MOBILE_WEB_CROSS_CLIENT_ACTION?.trim();
const runLive = action === "verify-web-and-update" || action === "verify-preserved-and-cleanup";
const describeLive = runLive ? describe : describe.skip;

describeLive("protected mobile/web live Supabase compatibility", () => {
  it("decrypts web records on mobile and preserves mobile forward fields through a web edit", async () => {
    const url = requireEnvironment("EXPO_PUBLIC_SUPABASE_URL");
    const publishableKey = requireEnvironment("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const email = requireEnvironment("LIVE_SUPABASE_TEST_EMAIL");
    const password = requireEnvironment("LIVE_SUPABASE_TEST_PASSWORD");
    const client = createClient(url, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const signIn = await client.auth.signInWithPassword({ email, password });

    if (signIn.error || !signIn.data.session) {
      throw new Error("Protected cross-client authentication failed.");
    }

    try {
      let session: VaultSession | null = null;
      const keyMaterialClient = client as unknown as SupabaseKeyMaterialClient;
      const vaultClient = client as unknown as SupabaseVaultClient;

      await unlockReturningUserVault({
        deriveKEK,
        initializeVault: async (keyBase64) => {
          session = createVaultSession({
            key: await fromBase64(keyBase64),
            repository: createSupabaseVaultRepository(vaultClient),
          });
          await session.loadPersistedAssets();
        },
        keyMaterialRepository: createSupabaseKeyMaterialRepository(keyMaterialClient),
        mekStorage: { set: async () => undefined },
        password,
        toBase64,
        unwrapMEK,
      });

      if (!session) throw new Error("Protected cross-client vault was not initialized.");
      const assets = (await (session as VaultSession).listActiveAssets()).filter(({ title }) =>
        title.startsWith("CC "),
      );
      const byType = new Map(assets.map((asset) => [asset.assetType, asset]));

      expect([...byType.keys()].sort()).toEqual([
        "business_interest",
        "card",
        "contact",
        "medical_care",
      ]);
      expect(byType.get("card")?.fields).toMatchObject({
        cardType: "Travel",
        country: "UAE",
        issuerName: "Synthetic Issuer",
      });
      expect(byType.get("card")?.fields.lastFourDigits).toBeUndefined();
      expect(byType.get("medical_care")?.fields.conditions).toContain("Synthetic allergy");
      expect(byType.get("business_interest")?.fields.instructions).toContain("continuity instructions");

      const contact = byType.get("contact");
      if (!contact) throw new Error("Synthetic contact was not found.");

      if (action === "verify-web-and-update") {
        await (session as VaultSession).updateAsset(contact.id, {
          assetType: "contact",
          fields: {
            ...contact.fields,
            futureMobileField: "forward-compatible-mobile-value",
            phone: "+971500000111",
          },
          notes: contact.notes,
          title: contact.title,
        });
        return;
      }

      expect(contact.fields).toMatchObject({
        futureMobileField: "forward-compatible-mobile-value",
        phone: "+971500000111",
      });
      expect(contact.notes).toBe("Web edit preserved mobile forward field");

      for (const asset of assets) {
        await (session as VaultSession).permanentlyDeleteAsset(asset.id);
      }

      expect((await (session as VaultSession).listActiveAssets()).filter(({ title }) =>
        title.startsWith("CC "),
      )).toHaveLength(0);
    } finally {
      await client.auth.signOut();
    }
  }, 120_000);
});

function requireEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the protected cross-client smoke.`);
  return value;
}
