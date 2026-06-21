import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function CardsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("card")} />;
}
