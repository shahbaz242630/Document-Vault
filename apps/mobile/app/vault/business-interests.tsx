import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function BusinessInterestsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("business_interest")} />;
}
