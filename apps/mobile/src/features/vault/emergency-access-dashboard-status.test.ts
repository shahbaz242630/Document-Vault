import { describe, expect, it } from "vitest";

import {
  createEmergencyAccessDashboardViewModel,
  createEmergencyAccessReminderDismissedUntil,
  deriveEmergencyAccessDashboardStatus,
  isEmergencyAccessReminderDismissed,
} from "./emergency-access-dashboard-status";

describe("emergency access dashboard status", () => {
  it("derives active, missing, and interrupted states from persisted setup", () => {
    expect(
      deriveEmergencyAccessDashboardStatus({
        hasActiveGrant: false,
        hasPendingConfirmation: false,
      }),
    ).toBe("none");
    expect(
      deriveEmergencyAccessDashboardStatus({
        hasActiveGrant: true,
        hasPendingConfirmation: false,
      }),
    ).toBe("active");
    expect(
      deriveEmergencyAccessDashboardStatus({
        hasActiveGrant: true,
        hasPendingConfirmation: true,
      }),
    ).toBe("interrupted");
  });

  it("shows a setup reminder only while it has not been deferred", () => {
    const now = new Date("2026-07-26T10:00:00.000Z");
    const dismissedUntil = createEmergencyAccessReminderDismissedUntil(now);

    expect(isEmergencyAccessReminderDismissed(dismissedUntil, now)).toBe(true);
    expect(
      createEmergencyAccessDashboardViewModel("none", dismissedUntil, now)
        .showReminder,
    ).toBe(false);
    expect(
      createEmergencyAccessDashboardViewModel("none", null, now).showReminder,
    ).toBe(true);
  });

  it("presents active access as ready without a reminder", () => {
    const viewModel = createEmergencyAccessDashboardViewModel(
      "active",
      null,
    );

    expect(viewModel.label).toBe("Ready");
    expect(viewModel.actionLabel).toBe("Review");
    expect(viewModel.showReminder).toBe(false);
  });
});
