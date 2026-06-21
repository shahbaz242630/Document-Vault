import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function DocumentLocationsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("document_location")} />;
}
