# Merged Slice 5M baseline — 2026-09-03

PR #68 merged as `f529803b8b556097f2d789b55dc1f3807bebfb5c` at
2026-09-03 07:36:31 UTC. Local merge `9f290db` safely integrated it into
`codex/claimant-offline-code-v2-case-binding`, retaining `20b0d89`, `f81516d`,
and `d6f594f`. Nothing was pushed or published.

Clean local reset from the integrated branch applied the full migration chain
including 5M to `supabase_db_sanduqkin`. No hosted system was targeted.
The merged catalog checker and its synthetic test catalog needed the local 5M
RPC added to their explicit inventories; no grant, schema, or assertion changed.

Verified using bundled Node 24.19.0 after refreshing the committed lockfile's
dependencies (system Node 24.2.0 is below the supported engine):

- All 26 claimant DB gates listed in Security CI, including hostile 5M SQL/RLS
  and a real two-session one-winner race, passed.
- Actual 5L mobile/Hono/verifier/PostgREST/RPC acceptance passed after those gates.
- All 1,265 workspace tests passed; three established mobile skips remain.
- All 255 serial script tests and every workspace typecheck passed.
- Source lint passed with generated `supabase/.temp/**` and the two protected
  untracked runtime/browser directories excluded at invocation only.
- Phase-1/security guards, local security catalog, RLS attack test, and security
  advisors passed. Advisors initially timed out during container restart, then
  passed after health recovered.
- Production dependency audit passed under the unchanged patched `image-size`
  exception through 2026-09-30; no advisory allowlist was broadened.

Test-order caveat: 5L intentionally retains synthetic locator fixtures, while
some legacy DB tests count whole tables. Run rollback-only DB gates before 5L
on a fresh disposable database. A broad filename-based runner also encountered
older standalone-only owner-notice tests; use the CI-listed live runners instead.
Neither condition required weakening or modifying a test.

The owner's baseline prerequisite for local synthetic, literal-false Slice 5N
is satisfied. This does not authorize external access, hosted mutation, deployment,
native/EAS builds, real claimant data, activation, or pushing/publishing 5M/5N.
`.codex-runtime/` and `.playwright-cli/` remain uninspected and untouched.
