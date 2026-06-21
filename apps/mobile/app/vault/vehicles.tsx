import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function VehiclesRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("vehicle")} />;
}
