const { spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");

const { createClient } = require("@supabase/supabase-js");
const { entropyToMnemonic, mnemonicToSeedSync } = require("bip39");
const sodium = require("libsodium-wrappers-sumo");

async function authenticateDisposableAccount(client, email, password, temporaryPassword) {
  let result = await client.auth.signInWithPassword({ email, password });
  if (!result.error) return result.data.user;

  result = await client.auth.signInWithPassword({ email, password: temporaryPassword });
  if (result.error) throw new Error("Disposable recovery account authentication failed.");

  const restored = await client.auth.updateUser({ password });
  if (restored.error) throw new Error("Disposable recovery account password restoration failed.");
  return result.data.user;
}

async function createWrappedKeyMaterial(password) {
  await sodium.ready;
  const phrase = entropyToMnemonic(randomBytes(16).toString("hex"));
  const mek = new Uint8Array(mnemonicToSeedSync(phrase).subarray(0, 32));
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);
  const kek = sodium.crypto_pwhash(
    32,
    password,
    salt,
    3,
    256 * 1024 * 1024,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    sodium.to_base64(mek),
    "vault:mek-wrap",
    null,
    nonce,
    kek,
  );
  return {
    phrase,
    row: {
      kdf_algorithm: "argon2id",
      kdf_params: { keyLength: 32, memlimit: 268435456, opslimit: 3 },
      kek_salt: sodium.to_base64(salt),
      recovery_version: 1,
      wrapped_mek_ciphertext: sodium.to_base64(ciphertext),
      wrapped_mek_nonce: sodium.to_base64(nonce),
    },
  };
}

async function resetDisposableVault(client, userId, row) {
  const deleted = await client.from("vault_assets").delete().eq("user_id", userId);
  if (deleted.error) throw new Error("Disposable recovery fixtures could not be cleared.");

  const saved = await client
    .from("vault_key_material")
    .upsert({ ...row, user_id: userId }, { onConflict: "user_id" });
  if (saved.error) throw new Error("Disposable recovery key material could not be saved.");
}

function runAndroidSmoke(environment) {
  const result = spawnSync(process.execPath, ["scripts/android-emulator-smoke.cjs"], {
    env: environment,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("Android emulator smoke runner failed.");
}

async function main() {
  const email = process.env.ANDROID_RECOVERY_E2E_EMAIL?.trim();
  const password = process.env.ANDROID_RECOVERY_E2E_PASSWORD;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!email || !password || !url || !publishableKey) {
    throw new Error("Disposable recovery bootstrap configuration is incomplete.");
  }

  const temporaryPassword = `${password}E2ETemporary!`;
  const client = createClient(url, publishableKey);
  const user = await authenticateDisposableAccount(client, email, password, temporaryPassword);
  const { phrase, row } = await createWrappedKeyMaterial(password);
  await resetDisposableVault(client, user.id, row);
  await client.auth.signOut();

  runAndroidSmoke({
    ...process.env,
    ANDROID_RECOVERY_E2E_PHRASE: phrase,
    ANDROID_RECOVERY_E2E_TEMP_PASSWORD: temporaryPassword,
  });
}

main().catch(() => {
  console.error("Android recovery E2E bootstrap failed; sensitive details were suppressed.");
  process.exitCode = 1;
});
