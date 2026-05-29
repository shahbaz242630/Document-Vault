import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { createBiometricStorage, createMekStorage, defaultAuditLog } from "@/features/auth";
import {
  fromBase64,
  generateMasterEncryptionKey,
  toBase64,
} from "@/shared/crypto/vault-crypto";
import * as ExpoSecureStore from "expo-secure-store";

import type { AssetPlaintextPayload } from "./asset-payload";
import { createVaultSession, type VaultSession } from "./vault-session";
import type { VaultDecryptedAsset, VaultDeletedAsset } from "./vault-store";

type VaultSessionContextValue = {
  addAsset: (payload: AssetPlaintextPayload) => Promise<VaultDecryptedAsset>;
  assets: VaultDecryptedAsset[];
  deletedAssets: VaultDeletedAsset[];
  initialize: (keyBase64: string) => Promise<void>;
  isLocked: boolean;
  isReady: boolean;
  lock: () => void;
  permanentlyDeleteAsset: (id: string) => Promise<void>;
  restoreAsset: (id: string) => Promise<void>;
  signOut: () => void;
  softDeleteAsset: (id: string) => Promise<void>;
  updateAsset: (
    id: string,
    payload: AssetPlaintextPayload,
  ) => Promise<VaultDecryptedAsset | null>;
};

const VaultSessionContext = createContext<VaultSessionContextValue | null>(null);

type VaultSessionProviderProps = {
  children: ReactNode;
};

export function VaultSessionProvider({ children }: VaultSessionProviderProps) {
  const [assets, setAssets] = useState<VaultDecryptedAsset[]>([]);
  const [deletedAssets, setDeletedAssets] = useState<VaultDeletedAsset[]>([]);
  const [session, setSession] = useState<VaultSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      const storage = createBiometricStorage(ExpoSecureStore);
      const biometricEnabled = await storage.isEnabled();
      const cachedKey = await storage.getKey();

      if (biometricEnabled && cachedKey) {
        if (isMounted) {
          setIsLocked(true);
        }
        return;
      }

      const mekStorage = createMekStorage(ExpoSecureStore);
      const storedMek = await mekStorage.get();

      const key = storedMek ? await fromBase64(storedMek) : await generateMasterEncryptionKey();

      if (isMounted) {
        setSession(createVaultSession({ key }));
        setIsReady(true);
      }

      if (biometricEnabled) {
        await storage.setKey(await toBase64(key));
      }
    }

    void initializeSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const initialize = useCallback(async (keyBase64: string) => {
    const key = await fromBase64(keyBase64);
    const newSession = createVaultSession({ key });
    defaultAuditLog.log({ deviceInfo: "React Native", eventType: "vault_unlocked" });
    setSession(newSession);
    setIsReady(true);
    setIsLocked(false);
    await refreshAssets(newSession);
  }, []);

  const lock = useCallback(() => {
    defaultAuditLog.log({ deviceInfo: "React Native", eventType: "vault_locked" });
    setSession(null);
    setAssets([]);
    setDeletedAssets([]);
    setIsReady(false);
    setIsLocked(true);
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    setAssets([]);
    setDeletedAssets([]);
    setIsReady(false);
    setIsLocked(false);
  }, []);

  const addAsset = useCallback(
    async (payload: AssetPlaintextPayload) => {
      if (!session) {
        throw new Error("Vault session is not ready yet.");
      }

      const asset = await session.addAsset(payload);
      defaultAuditLog.log({
        deviceInfo: "React Native",
        eventType: "asset_created",
        metadata: { assetId: asset.id, assetType: payload.assetType },
      });
      await refreshAssets(session);

      return asset;
    },
    [session],
  );

  const softDeleteAsset = useCallback(
    async (id: string) => {
      if (!session) {
        throw new Error("Vault session is not ready yet.");
      }

      session.softDeleteAsset(id);
      defaultAuditLog.log({
        deviceInfo: "React Native",
        eventType: "asset_soft_deleted",
        metadata: { assetId: id },
      });
      await refreshAssets(session);
    },
    [session],
  );

  const restoreAsset = useCallback(
    async (id: string) => {
      if (!session) {
        throw new Error("Vault session is not ready yet.");
      }

      session.restoreAsset(id);
      defaultAuditLog.log({
        deviceInfo: "React Native",
        eventType: "asset_restored",
        metadata: { assetId: id },
      });
      await refreshAssets(session);
    },
    [session],
  );

  const permanentlyDeleteAsset = useCallback(
    async (id: string) => {
      if (!session) {
        throw new Error("Vault session is not ready yet.");
      }

      session.permanentlyDeleteAsset(id);
      defaultAuditLog.log({
        deviceInfo: "React Native",
        eventType: "asset_permanently_deleted",
        metadata: { assetId: id },
      });
      await refreshAssets(session);
    },
    [session],
  );

  const updateAsset = useCallback(
    async (id: string, payload: AssetPlaintextPayload) => {
      if (!session) {
        throw new Error("Vault session is not ready yet.");
      }

      const asset = await session.updateAsset(id, payload);
      defaultAuditLog.log({
        deviceInfo: "React Native",
        eventType: "asset_updated",
        metadata: { assetId: id, assetType: payload.assetType },
      });
      await refreshAssets(session);

      return asset;
    },
    [session],
  );

  async function refreshAssets(activeSession: VaultSession) {
    const [nextAssets, nextDeletedAssets] = await Promise.all([
      activeSession.listActiveAssets(),
      activeSession.listDeletedAssets(),
    ]);

    setAssets(nextAssets);
    setDeletedAssets(nextDeletedAssets);
  }

  const value = useMemo<VaultSessionContextValue>(
    () => ({
      addAsset,
      assets,
      deletedAssets,
      initialize,
      isLocked,
      isReady,
      lock,
      permanentlyDeleteAsset,
      restoreAsset,
      signOut,
      softDeleteAsset,
      updateAsset,
    }),
    [
      addAsset,
      assets,
      deletedAssets,
      initialize,
      isLocked,
      isReady,
      lock,
      permanentlyDeleteAsset,
      restoreAsset,
      signOut,
      softDeleteAsset,
      updateAsset,
    ],
  );

  return (
    <VaultSessionContext.Provider value={value}>
      {children}
    </VaultSessionContext.Provider>
  );
}

export function useVaultSession(): VaultSessionContextValue {
  const value = useContext(VaultSessionContext);

  if (!value) {
    throw new Error("useVaultSession must be used inside VaultSessionProvider.");
  }

  return value;
}
