import { getVaultCategoryConfig, VaultCategoryRoute } from "@/features/vault";

export default function ContactsRoute() {
  return <VaultCategoryRoute config={getVaultCategoryConfig("contact")} />;
}
