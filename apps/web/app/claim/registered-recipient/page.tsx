import type { Metadata } from "next";

import { InactiveClaimRoutePage } from "@/components/inactive-claim-route-page";
import { claimantInformationRoutes } from "@/lib/claimant-portal";

export const metadata: Metadata = {
  title: "Registered recipient claims — not active",
  description: "Information about Sanduqkin's planned registered-recipient route. Claim applications are not active.",
  robots: { index: false, follow: false },
};

const route = claimantInformationRoutes[0];

export default function RegisteredRecipientClaimPage() {
  return <InactiveClaimRoutePage route={route} />;
}
