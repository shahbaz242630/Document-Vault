import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function InsuranceRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("insurance")} />;
}
