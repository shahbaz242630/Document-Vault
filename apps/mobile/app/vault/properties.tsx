import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function PropertiesRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("property")} />;
}
