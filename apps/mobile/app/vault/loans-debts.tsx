import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function LoansDebtsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("loan_debt")} />;
}
