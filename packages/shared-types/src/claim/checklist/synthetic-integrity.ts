import {
  canonicalJson,
  type CanonicalJsonValue,
} from "../canonical-json";
import type {
  SyntheticChecklistPolicyDraftV1,
  SyntheticChecklistPolicyPackV1,
} from "./contracts";

export function createSyntheticChecklistPolicyPack(
  draft: SyntheticChecklistPolicyDraftV1,
): SyntheticChecklistPolicyPackV1 {
  return {
    ...draft,
    integrity: {
      ...draft.integrity,
      checksum: computeSyntheticChecklistChecksum(draft),
    },
  };
}

export function hasValidSyntheticChecklistChecksum(
  pack: SyntheticChecklistPolicyPackV1,
): boolean {
  const { checksum, ...integrity } = pack.integrity;
  return checksum === computeSyntheticChecklistChecksum({ ...pack, integrity });
}

export function computeSyntheticChecklistChecksum(
  draft: SyntheticChecklistPolicyDraftV1,
): string {
  const canonical = canonicalJson(
    JSON.parse(JSON.stringify(draft)) as CanonicalJsonValue,
  );
  let hash = 0x811c9dc5;
  for (let index = 0; index < canonical.length; index += 1) {
    hash ^= canonical.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `synthetic_checksum_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
