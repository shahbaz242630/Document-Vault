export const siteName = "Sanduqkin";
export const siteUrl = "https://sanduqkin.com";

export const primaryNavigation = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/security", label: "Security" },
  { href: "/claim", label: "Claim access" },
] as const;

export const legalNavigation = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/account-deletion", label: "Account deletion" },
  { href: "/accessibility", label: "Accessibility" },
] as const;

export const claimInformationRoutes = [
  "/claim/registered-recipient",
  "/claim/emergency-code",
] as const;

export const claimSyntheticPreviewRoute = "/claim/synthetic-preview" as const;
export const claimSyntheticChecklistRoute = "/claim/synthetic-checklist" as const;
export const claimSyntheticEvidenceRoute = "/claim/synthetic-evidence" as const;

export const publicRoutes = [
  "/",
  ...primaryNavigation.map(({ href }) => href),
  ...claimInformationRoutes,
  claimSyntheticPreviewRoute,
  claimSyntheticChecklistRoute,
  claimSyntheticEvidenceRoute,
  ...legalNavigation.map(({ href }) => href),
  "/support",
] as const;

export const contentVersion = {
  label: "Preview draft 0.1",
  reviewed: "19 July 2026",
  status: "Not yet effective",
} as const;
