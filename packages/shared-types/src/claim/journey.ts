import type { ClaimantState } from "./contracts";

export const claimantPublicJourneyStages = [
  "route_verification_needed",
  "documents_needed",
  "documents_received",
  "under_review",
  "action_needed_or_on_hold",
  "owner_protection_in_progress",
  "decision_recorded",
  "secure_retrieval_available",
  "retrieval_confirmed_closed",
] as const;

export type ClaimantPublicJourneyStage =
  (typeof claimantPublicJourneyStages)[number];

export type ClaimantPublicJourneyMilestone = {
  key: ClaimantPublicJourneyStage;
  label: string;
  status: "complete" | "current" | "upcoming";
};

export type ClaimantPublicJourneyProjectionV1 = {
  protocol: "sanduqkin:claim:journey-projection:v1";
  stage: ClaimantPublicJourneyStage;
  title: string;
  summary: string;
  next_action: string;
  claimant_action_required: boolean;
  milestones: ClaimantPublicJourneyMilestone[];
};

type PublicStageContent = Omit<
  ClaimantPublicJourneyProjectionV1,
  "milestones" | "protocol" | "stage"
> & {
  label: string;
};

const publicStageContent = {
  route_verification_needed: {
    claimant_action_required: true,
    label: "Route verification",
    next_action: "Complete account and route verification when invited.",
    summary:
      "Your account and access route must be verified before an application can continue.",
    title: "Route verification needed",
  },
  documents_needed: {
    claimant_action_required: true,
    label: "Documents needed",
    next_action: "Provide only the items shown in your approved checklist.",
    summary:
      "Your case needs the minimum documents required by its approved checklist.",
    title: "Documents needed",
  },
  documents_received: {
    claimant_action_required: false,
    label: "Documents protected",
    next_action: "No action is needed unless a secure case update asks for it.",
    summary:
      "Your submitted documents were received and placed in the protected review workspace.",
    title: "Documents received and protected",
  },
  under_review: {
    claimant_action_required: false,
    label: "Under review",
    next_action: "Wait for a secure case update.",
    summary:
      "The required independent checks are in progress. Private review details are not displayed.",
    title: "Under review",
  },
  action_needed_or_on_hold: {
    claimant_action_required: true,
    label: "Case update needed",
    next_action: "Open the secure case update and follow only its stated next step.",
    summary:
      "The case needs more information or is safely paused while an issue is resolved.",
    title: "More information needed or on hold",
  },
  owner_protection_in_progress: {
    claimant_action_required: false,
    label: "Protection checks",
    next_action: "No action is needed unless a secure case update asks for it.",
    summary:
      "Required protection and authority checks are in progress. Their private details are not displayed.",
    title: "Owner-protection checks in progress",
  },
  decision_recorded: {
    claimant_action_required: true,
    label: "Decision recorded",
    next_action: "Open the secure case update to review the available next step.",
    summary:
      "A controlled decision has been recorded. This status does not itself provide vault access.",
    title: "Decision recorded",
  },
  secure_retrieval_available: {
    claimant_action_required: true,
    label: "Secure retrieval",
    next_action:
      "Use the approved native client and fresh authentication to continue securely.",
    summary:
      "A time-limited encrypted package is available for approved local retrieval.",
    title: "Secure retrieval available",
  },
  retrieval_confirmed_closed: {
    claimant_action_required: false,
    label: "Case closed",
    next_action: "No further action is currently required.",
    summary:
      "Retrieval was explicitly confirmed and the case is closed under the applicable policy.",
    title: "Retrieval confirmed and case closed",
  },
} as const satisfies Record<ClaimantPublicJourneyStage, PublicStageContent>;

const internalToPublicStage = {
  approved: "decision_recorded",
  cancelled_by_owner: "decision_recorded",
  closed: "retrieval_confirmed_closed",
  cooldown: "owner_protection_in_progress",
  draft: "route_verification_needed",
  expired: "decision_recorded",
  identity_pending: "documents_needed",
  manual_review: "under_review",
  on_hold: "action_needed_or_on_hold",
  owner_notified: "owner_protection_in_progress",
  rejected: "decision_recorded",
  release_ready: "secure_retrieval_available",
  release_suspended: "decision_recorded",
  released: "secure_retrieval_available",
  review_pending: "under_review",
  submitted: "documents_received",
  withdrawn_by_claimant: "decision_recorded",
} as const satisfies Record<ClaimantState, ClaimantPublicJourneyStage>;

export function projectClaimantPublicJourney(
  internalState: ClaimantState,
): ClaimantPublicJourneyProjectionV1 {
  const stage = internalToPublicStage[internalState];
  const content = publicStageContent[stage];
  const currentIndex = claimantPublicJourneyStages.indexOf(stage);

  return {
    protocol: "sanduqkin:claim:journey-projection:v1",
    stage,
    title: content.title,
    summary: content.summary,
    next_action: content.next_action,
    claimant_action_required: content.claimant_action_required,
    milestones: claimantPublicJourneyStages.map((key, index) => ({
      key,
      label: publicStageContent[key].label,
      status:
        index < currentIndex
          ? "complete"
          : index === currentIndex
            ? "current"
            : "upcoming",
    })),
  };
}
