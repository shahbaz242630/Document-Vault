import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function CryptoRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("crypto")} />;
}
