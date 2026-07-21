/// <reference lib="webworker" />

import {
  clearSecret,
  decryptAssetV1,
  encryptAssetV1,
  unlockMekV1,
} from "./crypto";
import type { VaultWorkerRequest } from "./crypto-worker-protocol";

let activeMek: Uint8Array | null = null;

self.onmessage = async ({ data }: MessageEvent<VaultWorkerRequest>) => {
  try {
    if (data.operation === "unlock") {
      clearSecret(activeMek);
      activeMek = await unlockMekV1(data.password, data.material);
      self.postMessage({ id: data.id, ok: true, result: "unlocked" });
      return;
    }
    if (data.operation === "lock") {
      clearSecret(activeMek);
      activeMek = null;
      self.postMessage({ id: data.id, ok: true, result: "locked" });
      return;
    }
    if (!activeMek) throw new Error("Vault worker is locked.");
    const result = data.operation === "decrypt"
      ? await decryptAssetV1(activeMek, data.asset)
      : await encryptAssetV1(activeMek, data.payload);
    self.postMessage({ id: data.id, ok: true, result });
  } catch {
    self.postMessage({ id: data.id, ok: false, error: "Vault cryptography operation failed." });
  }
};

export {};
