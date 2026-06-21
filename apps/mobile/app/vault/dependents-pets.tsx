import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function DependentsPetsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("dependent_pet")} />;
}
