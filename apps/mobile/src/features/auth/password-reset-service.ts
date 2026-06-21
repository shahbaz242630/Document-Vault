import { deriveKEK, generateSalt } from "@/shared/crypto/kek-derivation";
import { wrapMEK } from "@/shared/crypto/mek-wrapping";
import { toBase64 } from "@/shared/crypto/vault-crypto";
import type { VaultKeyMaterial } from "@/features/vault";

import { deriveMasterKeyFromPhrase } from "./recovery-phrase-service";

type SupabaseAuthResponse = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type SupabaseAuthClient = {
  auth: {
    resetPasswordForEmail?: (email: string, options?: { redirectTo?: string }) => SupabaseAuthResponse;
    updateUser?: (attributes: { password: string }) => SupabaseAuthResponse;
  };
};

type KeyMaterialRepository = {
  loadKeyMaterial?: () => Promise<VaultKeyMaterial | null>;
  saveKeyMaterial: (keyMaterial: VaultKeyMaterial) => Promise<unknown>;
};

type PasswordResetServiceDependencies = {
  keyMaterialRepository?: KeyMaterialRepository | null;
};

export type PasswordResetRequestResult =
  | { message: string; status: "error" }
  | { message: string; status: "ok" }
  | { message: string; status: "unavailable" };

export type RecoveryResetResult =
  | { message: string; status: "error" }
  | { mekBase64: string; saltBase64: string; wrapped: { ciphertextBase64: string; nonceBase64: string }; status: "ok" };

export function createPasswordResetService(
  client: SupabaseAuthClient | null,
  dependencies: PasswordResetServiceDependencies = {},
) {
  return {
    async requestReset(email: string): Promise<PasswordResetRequestResult> {
      if (!client?.auth.resetPasswordForEmail) {
        return {
          message: "Supabase is not configured yet.",
          status: "unavailable",
        };
      }

      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: "vault://auth/reset-password",
      });

      if (error) {
        return {
          message: "Could not send reset email. Try again.",
          status: "error",
        };
      }

      return {
        message: "Check your email for a reset link.",
        status: "ok",
      };
    },

    async resetWithRecoveryPhrase(opts: {
      newPassword: string;
      phrase: string[];
    }): Promise<RecoveryResetResult> {
      if (opts.phrase.length !== 12) {
        return {
          message: "Recovery phrase must have exactly 12 words.",
          status: "error",
        };
      }

      if (opts.newPassword.length < 12) {
        return {
          message: "Password must be at least 12 characters.",
          status: "error",
        };
      }

      try {
        const mek = deriveMasterKeyFromPhrase(opts.phrase);
        const salt = await generateSalt();
        const kek = await deriveKEK(opts.newPassword, salt);
        const wrapped = await wrapMEK(mek, kek);
        const existingKeyMaterial =
          await dependencies.keyMaterialRepository?.loadKeyMaterial?.();

        if (client?.auth.updateUser) {
          const { error } = await client.auth.updateUser({
            password: opts.newPassword,
          });

          if (error) {
            return {
              message: "Could not update password. Open the reset link again and try recovery.",
              status: "error",
            };
          }
        }

        await dependencies.keyMaterialRepository?.saveKeyMaterial({
          kdfAlgorithm: "argon2id",
          kdfParams: {
            keyLength: 32,
            memlimit: 268435456,
            opslimit: 3,
          },
          kekSalt: salt,
          recoveryVersion: (existingKeyMaterial?.recoveryVersion ?? 1) + 1,
          wrappedMek: wrapped,
        });

        return {
          mekBase64: await toBase64(mek),
          saltBase64: await toBase64(salt),
          status: "ok",
          wrapped: {
            ciphertextBase64: await toBase64(wrapped.ciphertext),
            nonceBase64: await toBase64(wrapped.nonce),
          },
        };
      } catch {
        return {
          message: "Could not recover vault. Check your recovery phrase.",
          status: "error",
        };
      }
    },
  };
}
