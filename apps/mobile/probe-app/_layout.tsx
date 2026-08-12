import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";

export default function ClaimantCustodyProbeLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
