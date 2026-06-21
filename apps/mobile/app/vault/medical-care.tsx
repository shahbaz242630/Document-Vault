import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function MedicalCareRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("medical_care")} />;
}
