import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createBiometricStorage,
  createMekStorage,
  defaultAuditLog,
  type AuditEventType,
} from "@/features/auth";
import {
  fromBase64,
  generateMasterEncryptionKey,
  toBase64,
} from "@/shared/crypto/vault-crypto";
import * as ExpoSecureStore from "expo-secure-store";

import type { AssetPlaintextPayload } from "./asset-payload";
import {
  createSupabaseVaultRepository,
  type SupabaseVaultClient,
} from "./supabase-vault-repository";
import {
  createVaultSession,
  type VaultAssetRepository,
  type VaultSession,
} from "./vault-session";
import type { VaultDecryptedAsset, VaultDeletedAsset } from "./vault-store";

type VaultSessionContextValue = {
  addAsset: (payload: AssetPlaintextPayload) => Promise<VaultDecryptedAsset>;
  assets: VaultDecryptedAsset[];
  deletedAssets: VaultDeletedAsset[];
  initialize: (keyBase64: string, client?: SupabaseVaultClient) => Promise<void>;
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

type VaultSessionStateSetters = {
  setAssets: Dispatch<SetStateAction<VaultDecryptedAsset[]>>;
  setDeletedAssets: Dispatch<SetStateAction<VaultDeletedAsset[]>>;
  setIsLocked: Dispatch<SetStateAction<boolean>>;
  setIsReady: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<VaultSession | null>>;
};

const VaultSessionContext = createContext<VaultSessionContextValue | null>(null);

type VaultSessionProviderProps = {
  children: ReactNode;
};

export function VaultSessionProvider({ children }: VaultSessionProviderProps) {
  const value = useVaultSessionContextValue();

  return (
    <VaultSessionContext.Provider value={value}>
      {children}
    </VaultSessionContext.Provider>
  );
}

function useVaultSessionContextValue(): VaultSessionContextValue {
  const [assets, setAssets] = useState<VaultDecryptedAsset[]>([]);
  const [deletedAssets, setDeletedAssets] = useState<VaultDeletedAsset[]>([]);
  const [session, setSession] = useState<VaultSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const setters = useMemo(
    () => ({ setAssets, setDeletedAssets, setIsLocked, setIsReady, setSession }),
    [],
  );
  const refreshAssets = useRefreshAssets(setters);

  useStartupSession({ refreshAssets, setters });

  const initialize = useVaultInitialize({ refreshAssets, setters });
  const { lock, signOut } = useVaultLifecycleActions(setters);
  const assetActions = useVaultAssetActions({ refreshAssets, session });

  return useMemo(
    () => ({
      ...assetActions,
      assets,
      deletedAssets,
      initialize,
      isLocked,
      isReady,
      lock,
      signOut,
    }),
    [
      assetActions,
      assets,
      deletedAssets,
      initialize,
      isLocked,
      isReady,
      lock,
      signOut,
    ],
  );
}

function useStartupSession({
  refreshAssets,
  setters,
}: {
  refreshAssets: (activeSession: VaultSession) => Promise<void>;
  setters: VaultSessionStateSetters;
}) {
  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      const storage = createBiometricStorage(ExpoSecureStore);
      const biometricEnabled = await storage.isEnabled();
      const cachedKey = await storage.getKey();

      if (biometricEnabled && cachedKey) {
        if (isMounted) {
          setters.setIsLocked(true);
        }
        return;
      }

      const key = await loadStartupVaultKey();
      const newSession = createVaultSession({ key });

      if (isMounted) {
        setters.setSession(newSession);
        setters.setIsReady(true);
        await refreshAssets(newSession);
      }

      if (biometricEnabled) {
        await storage.setKey(await toBase64(key));
      }
    }

    void initializeSession();

    return () => {
      isMounted = false;
    };
  }, [refreshAssets, setters]);
}

function useVaultInitialize({
  refreshAssets,
  setters,
}: {
  refreshAssets: (activeSession: VaultSession) => Promise<void>;
  setters: VaultSessionStateSetters;
}) {
  return useCallback(
    async (keyBase64: string, client?: SupabaseVaultClient) => {
      const key = await fromBase64(keyBase64);
      const newSession = createVaultSession({
        key,
        repository: createOptionalVaultRepository(client),
      });
      await newSession.loadPersistedAssets();
      defaultAuditLog.log({ deviceInfo: "React Native", eventType: "vault_unlocked" });
      setters.setSession(newSession);
      setters.setIsReady(true);
      setters.setIsLocked(false);
      await refreshAssets(newSession);
    },
    [refreshAssets, setters],
  );
}

function useVaultLifecycleActions(setters: VaultSessionStateSetters) {
  const lock = useCallback(() => {
    defaultAuditLog.log({ deviceInfo: "React Native", eventType: "vault_locked" });
    clearVaultSession(setters);
    setters.setIsLocked(true);
  }, [setters]);

  const signOut = useCallback(() => {
    clearVaultSession(setters);
    setters.setIsLocked(false);
  }, [setters]);

  return useMemo(() => ({ lock, signOut }), [lock, signOut]);
}

function useVaultAssetActions({
  refreshAssets,
  session,
}: {
  refreshAssets: (activeSession: VaultSession) => Promise<void>;
  session: VaultSession | null;
}) {
  const addAsset = useCallback(async (payload: AssetPlaintextPayload) => {
    const activeSession = requireVaultSession(session);
    const asset = await activeSession.addAsset(payload);
    logAssetEvent("asset_created", { assetId: asset.id, assetType: payload.assetType });
    await refreshAssets(activeSession);
    return asset;
  }, [refreshAssets, session]);

  const softDeleteAsset = useAssetIdAction(session, refreshAssets, "softDeleteAsset", "asset_soft_deleted");
  const restoreAsset = useAssetIdAction(session, refreshAssets, "restoreAsset", "asset_restored");
  const permanentlyDeleteAsset = useAssetIdAction(
    session,
    refreshAssets,
    "permanentlyDeleteAsset",
    "asset_permanently_deleted",
  );
  const updateAsset = useUpdateAssetAction(session, refreshAssets);

  return useMemo(
    () => ({ addAsset, permanentlyDeleteAsset, restoreAsset, softDeleteAsset, updateAsset }),
    [addAsset, permanentlyDeleteAsset, restoreAsset, softDeleteAsset, updateAsset],
  );
}

function useAssetIdAction(
  session: VaultSession | null,
  refreshAssets: (activeSession: VaultSession) => Promise<void>,
  method: "permanentlyDeleteAsset" | "restoreAsset" | "softDeleteAsset",
  eventType: "asset_permanently_deleted" | "asset_restored" | "asset_soft_deleted",
) {
  return useCallback(
    async (id: string) => {
      const activeSession = requireVaultSession(session);
      await activeSession[method](id);
      logAssetEvent(eventType, { assetId: id });
      await refreshAssets(activeSession);
    },
    [eventType, method, refreshAssets, session],
  );
}

function useUpdateAssetAction(
  session: VaultSession | null,
  refreshAssets: (activeSession: VaultSession) => Promise<void>,
) {
  return useCallback(
    async (id: string, payload: AssetPlaintextPayload) => {
      const activeSession = requireVaultSession(session);
      const asset = await activeSession.updateAsset(id, payload);
      logAssetEvent("asset_updated", { assetId: id, assetType: payload.assetType });
      await refreshAssets(activeSession);
      return asset;
    },
    [refreshAssets, session],
  );
}

function useRefreshAssets(setters: VaultSessionStateSetters) {
  return useCallback(
    async (activeSession: VaultSession) => {
      const [nextAssets, nextDeletedAssets] = await Promise.all([
        activeSession.listActiveAssets(),
        activeSession.listDeletedAssets(),
      ]);

      setters.setAssets(nextAssets);
      setters.setDeletedAssets(nextDeletedAssets);
    },
    [setters],
  );
}

export function useVaultSession(): VaultSessionContextValue {
  const value = useContext(VaultSessionContext);

  if (!value) {
    throw new Error("useVaultSession must be used inside VaultSessionProvider.");
  }

  return value;
}

async function loadStartupVaultKey() {
  const mekStorage = createMekStorage(ExpoSecureStore);
  const storedMek = await mekStorage.get();

  return storedMek ? fromBase64(storedMek) : generateMasterEncryptionKey();
}

function clearVaultSession(setters: VaultSessionStateSetters) {
  setters.setSession(null);
  setters.setAssets([]);
  setters.setDeletedAssets([]);
  setters.setIsReady(false);
}

function requireVaultSession(session: VaultSession | null) {
  if (!session) {
    throw new Error("Vault session is not ready yet.");
  }

  return session;
}

function logAssetEvent(eventType: AuditEventType, metadata: Record<string, string>) {
  defaultAuditLog.log({
    deviceInfo: "React Native",
    eventType,
    metadata,
  });
}

function createOptionalVaultRepository(
  existingClient?: SupabaseVaultClient,
): VaultAssetRepository | undefined {
  if (!existingClient) {
    return undefined;
  }

  return createSupabaseVaultRepository(existingClient);
}
