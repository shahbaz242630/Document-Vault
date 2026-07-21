import type {
  EncryptedAssetV1,
  VaultAssetPlaintext,
  WrappedKeyMaterialV1,
} from "./crypto";

export type VaultWorkerRequest =
  | { id: string; operation: "unlock"; password: string; material: WrappedKeyMaterialV1 }
  | { id: string; operation: "decrypt"; asset: EncryptedAssetV1 }
  | { id: string; operation: "encrypt"; payload: VaultAssetPlaintext }
  | { id: string; operation: "lock" };

export type VaultWorkerResponse =
  | { id: string; ok: true; result: "unlocked" | "locked" | EncryptedAssetV1 | VaultAssetPlaintext }
  | { id: string; ok: false; error: string };
