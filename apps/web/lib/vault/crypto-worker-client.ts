import type { EncryptedAssetV1, VaultAssetPlaintext, WrappedKeyMaterialV1 } from "./crypto";
import type { VaultWorkerRequest, VaultWorkerResponse } from "./crypto-worker-protocol";

type PendingOperation = {
  reject: (reason: Error) => void;
  resolve: (value: VaultWorkerSuccessResult) => void;
};

type VaultWorkerSuccessResult = Extract<VaultWorkerResponse, { ok: true }>["result"];
type VaultWorkerRequestWithoutId = VaultWorkerRequest extends infer Request
  ? Request extends { id: string }
    ? Omit<Request, "id">
    : never
  : never;

export function createVaultCryptoWorkerClient() {
  const worker = new Worker(new URL("./crypto-worker.ts", import.meta.url));
  const pending = new Map<string, PendingOperation>();

  worker.onmessage = ({ data }: MessageEvent<VaultWorkerResponse>) => {
    const operation = pending.get(data.id);
    if (!operation) return;
    pending.delete(data.id);
    if (data.ok) operation.resolve(data.result);
    else operation.reject(new Error(data.error));
  };
  worker.onerror = () => {
    for (const operation of pending.values()) operation.reject(new Error("Vault worker failed."));
    pending.clear();
  };

  function request(requestData: VaultWorkerRequestWithoutId) {
    const id = crypto.randomUUID();
    return new Promise<VaultWorkerSuccessResult>((resolve, reject) => {
      pending.set(id, { reject, resolve });
      worker.postMessage({ ...requestData, id } as VaultWorkerRequest);
    });
  }

  return {
    decrypt: (asset: EncryptedAssetV1) => request({ operation: "decrypt", asset }) as Promise<VaultAssetPlaintext>,
    encrypt: (payload: VaultAssetPlaintext) => request({ operation: "encrypt", payload }) as Promise<EncryptedAssetV1>,
    lock: () => request({ operation: "lock" }),
    terminate() {
      worker.terminate();
      for (const operation of pending.values()) operation.reject(new Error("Vault worker terminated."));
      pending.clear();
    },
    unlock: (password: string, material: WrappedKeyMaterialV1) => request({ operation: "unlock", password, material }),
  };
}

export type VaultCryptoWorkerClient = ReturnType<typeof createVaultCryptoWorkerClient>;
