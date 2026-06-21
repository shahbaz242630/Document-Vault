import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function InvestmentsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("investment")} />;
}
