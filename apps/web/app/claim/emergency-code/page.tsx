import type { Metadata } from "next";

import { InactiveClaimRoutePage } from "@/components/inactive-claim-route-page";
import { claimantInformationRoutes } from "@/lib/claimant-portal";

export const metadata: Metadata = {
  title: "Emergency-code claims — not active",
  description: "Information about Sanduqkin's planned V2 emergency-code route. Claim applications are not active.",
  robots: { index: false, follow: false },
};

const route = claimantInformationRoutes[1];

export default function EmergencyCodeClaimPage() {
  return <InactiveClaimRoutePage route={route} />;
}
