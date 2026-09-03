# Claimant Slice 2F — Hard-Disabled Evidence-Upload Client Coordinator

Date: 2026-08-12 (Asia/Dubai)

## Decision

The bounded local Slice 2F client increment is code-complete on `codex/claimant-upload-client-coordinator`. It adds an injected-transport coordinator for synthetic prepared evidence while `CLAIMANT_EVIDENCE_UPLOAD_COORDINATOR_APPROVED = false` and the claimant portal `evidenceUpload` capability remains false. The module is not imported by any normal web runtime source. No real file picker, provider SDK, browser persistence, hosted configuration, deployment, or external claimant behavior was added.

## Implemented boundary

- Prepared synthetic placeholder metadata is bound to the case, expected case/intake versions, checklist item, preparation version, media type, exact body size, and capability request.
- Capability responses must contain a 256-bit Base64URL token, canonical UUIDv4 object identifier, exact server-derived `v1/{caseId}/{objectId}` path, and a canonical unexpired timestamp.
- Upload accepts an already-supplied `Uint8Array` only. It rejects empty, oversized, size-mismatched, or non-synthetic input before touching transport and has no file-selection or form-data code.
- Progress is integer, monotonic, and bounded by the prepared byte count. Concurrent work fails closed.
- Conflict, unavailable transport, or malformed upload behavior is treated as ambiguous. The coordinator consults server reconciliation before returning terminal success.
- Aborted or unresolved work can retain only an in-memory capability/object tuple for explicit reconciliation. A new upload cannot overwrite pending reconciliation authority. Evidence bytes and capabilities are never written to browser persistence.
- Public errors are generic and do not forward provider topology, tokens, paths, or evidence detail.

## Immutable gates and limitations

- `CLAIMANT_EVIDENCE_UPLOAD_COORDINATOR_APPROVED = false`.
- Claimant portal `evidenceUpload: false` remains unchanged.
- Static isolation rejects normal web imports, direct network clients, browser persistence, file APIs, provider SDKs, and object-storage endpoints.
- The transport is an injected contract only; there is no production HTTP adapter, reload-safe server lookup, UI, route, file picker, real evidence, or provider configuration.
- Existing local claimant and Storage migrations remain undeployed. Production remains on its verified rollback deployment.

## Verification

All commands passed locally on 2026-08-12:

- `npm test --workspaces --if-present`: 947 passed; 3 environment-gated mobile tests skipped.
- Focused coordinator suite: 7 passed.
- `npm run typecheck`: all workspaces passed.
- `npm run lint`: passed with zero warnings.
- `npm run web:build`: production web build passed with 24 routes.
- `npm run check:claimant-upload-client-isolation`: passed.
- `node --test scripts/claimant-upload-client-isolation-check.test.cjs`: passed.
- `npm run check:api-vercel-bundle`: passed.
- GitHub Actions security regression: 23 passed.
- `git diff --check`: passed.

Hostile coverage includes disabled-before-transport behavior, body and version mismatch, wrong object path, non-monotonic/oversized progress, ambiguous completion reconciliation, in-memory bounded retry, cancellation, overlapping work, and provider-error redaction.

## Staging and production

Slice 2F is runtime-disconnected and was not deployed. The previously verified Slice 2E preview remains `dpl_C6PGm7FBQn4LTLhYXyJHe1vh8Kro`; production remains healthy on rollback deployment `dpl_H7NXnWujWdcLd6coKrraDHe1N5gr`. No promotion or production change occurred.

## Next bounded slice

Add a hard-disabled claimant dashboard/read-model coordinator using synthetic projections and injected transport. Keep server state authoritative, avoid browser persistence of sensitive claim/evidence state, and retain real providers, hosted configuration, deployment, and external access as separate gates.
