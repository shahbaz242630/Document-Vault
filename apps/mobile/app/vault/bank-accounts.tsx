import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function BankAccountsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("bank_account")} />;
}
