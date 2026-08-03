import { applySyntheticClaimScenarioStep } from "../scenario";
import { createSyntheticSubmissionAcknowledgement } from "./acknowledgement";
import { validateSyntheticSubmissionHandoffBindings } from "./bindings";
import type {
  SyntheticSubmissionHandoffInputV1,
  SyntheticSubmissionHandoffResultV1,
} from "./contracts";

export function applySyntheticSubmissionHandoff(
  input: SyntheticSubmissionHandoffInputV1,
): SyntheticSubmissionHandoffResultV1 {
  const bindingIssue = validateSyntheticSubmissionHandoffBindings(input);
  if (bindingIssue) return denied(input, bindingIssue);

  try {
    const scenarioResult = applySyntheticClaimScenarioStep(input.snapshot, input.step);
    if (scenarioResult.status === "denied") {
      return denied(input, scenarioResult.reason);
    }
    return {
      status: scenarioResult.status,
      acknowledgement: createSyntheticSubmissionAcknowledgement({
        envelope: input.envelope,
        snapshot: scenarioResult.snapshot,
        duplicate: scenarioResult.status === "duplicate",
      }),
      snapshot: scenarioResult.snapshot,
      invalidates: scenarioResult.invalidates,
    };
  } catch {
    return denied(input, "invalid_step");
  }
}

function denied(
  input: SyntheticSubmissionHandoffInputV1,
  reason: Extract<SyntheticSubmissionHandoffResultV1, { status: "denied" }>["reason"],
): SyntheticSubmissionHandoffResultV1 {
  return {
    status: "denied",
    reason,
    acknowledgement: null,
    snapshot: input.snapshot,
    invalidates: [],
  };
}
