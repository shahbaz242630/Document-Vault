import { useLocalSearchParams } from "expo-router";

import { OwnerSheetDetailPanel } from "@/features/claimant-offline-code/owner-sheet-detail-panel";
import { Screen } from "@/shared/ui";

export default function EmergencySheetDetailRoute() {
  const params = useLocalSearchParams<{ id?: string; action?: string }>();
  return (
    <Screen>
      <OwnerSheetDetailPanel initialAction={params.action} locatorRecordId={params.id ?? ""} />
    </Screen>
  );
}
