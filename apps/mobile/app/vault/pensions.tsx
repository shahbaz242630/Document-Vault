import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function PensionsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("pension")} />;
}
