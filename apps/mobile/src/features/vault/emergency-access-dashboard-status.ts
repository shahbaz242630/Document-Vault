export const emergencyAccessPendingConfirmationKey =
  "sanduqkin.sealedEmergencyCode.pendingConfirmation";
export const emergencyAccessReminderDismissedUntilKey =
  "sanduqkin.emergencyAccessReminder.dismissedUntil";

export type EmergencyAccessDashboardStatus =
  | "loading"
  | "none"
  | "active"
  | "interrupted"
  | "unavailable";

export type EmergencyAccessDashboardViewModel = {
  actionLabel: string;
  body: string;
  icon: "shield-checkmark-outline" | "alert-circle-outline" | "shield-outline";
  label: string;
  showReminder: boolean;
  tone: "success" | "attention" | "neutral";
};

export function deriveEmergencyAccessDashboardStatus({
  hasActiveGrant,
  hasPendingConfirmation,
}: {
  hasActiveGrant: boolean;
  hasPendingConfirmation: boolean;
}): EmergencyAccessDashboardStatus {
  if (hasActiveGrant && hasPendingConfirmation) {
    return "interrupted";
  }

  return hasActiveGrant ? "active" : "none";
}

export function createEmergencyAccessDashboardViewModel(
  status: EmergencyAccessDashboardStatus,
  reminderDismissedUntil: string | null,
  now = new Date(),
): EmergencyAccessDashboardViewModel {
  const reminderIsDismissed = isEmergencyAccessReminderDismissed(
    reminderDismissedUntil,
    now,
  );

  if (status === "active") {
    return {
      actionLabel: "Review",
      body: "Your sealed emergency access code is protected and ready.",
      icon: "shield-checkmark-outline",
      label: "Ready",
      showReminder: false,
      tone: "success",
    };
  }

  if (status === "interrupted") {
    return {
      actionLabel: "Fix now",
      body: "Emergency code setup was interrupted and needs your attention.",
      icon: "alert-circle-outline",
      label: "Needs attention",
      showReminder: !reminderIsDismissed,
      tone: "attention",
    };
  }

  if (status === "none") {
    return {
      actionLabel: "Set up access",
      body: "Choose how your family can request access in an emergency.",
      icon: "shield-outline",
      label: "Not set up",
      showReminder: !reminderIsDismissed,
      tone: "attention",
    };
  }

  return {
    actionLabel: status === "loading" ? "Checking..." : "Review",
    body:
      status === "loading"
        ? "Checking your emergency access readiness."
        : "We could not verify emergency access right now.",
    icon: "shield-outline",
    label: status === "loading" ? "Checking" : "Check later",
    showReminder: false,
    tone: "neutral",
  };
}

export function createEmergencyAccessReminderDismissedUntil(
  now = new Date(),
): string {
  const dismissedUntil = new Date(now);
  dismissedUntil.setDate(dismissedUntil.getDate() + 7);
  return dismissedUntil.toISOString();
}

export function isEmergencyAccessReminderDismissed(
  dismissedUntil: string | null,
  now = new Date(),
): boolean {
  if (!dismissedUntil) {
    return false;
  }

  const timestamp = Date.parse(dismissedUntil);
  return Number.isFinite(timestamp) && timestamp > now.getTime();
}
