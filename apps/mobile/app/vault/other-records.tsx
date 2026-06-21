import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function OtherRecordsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("other")} />;
}
