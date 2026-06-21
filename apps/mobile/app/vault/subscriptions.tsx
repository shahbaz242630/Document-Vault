import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function SubscriptionsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("subscription")} />;
}
