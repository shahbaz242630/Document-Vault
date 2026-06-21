import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function DigitalAccountsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("digital_account")} />;
}
