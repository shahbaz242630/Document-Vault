const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const root = join(__dirname, "..");
const migration = readFileSync(join(root, "supabase", "migrations",
  "20260818120000_claimant_reviewer_assignment_foundation.sql"), "utf8");
const service = readFileSync(join(root, "services", "api", "src", "claimant",
  "reviewer-assignment-service.ts"), "utf8");
const client = readFileSync(join(root, "services", "api", "src", "claimant",
  "reviewer-assignment-transaction-client.ts"), "utf8");
const index = readFileSync(join(root, "services", "api", "src", "index.ts"), "utf8");

test("creates four forced-RLS reviewer foundation tables with explicit client denial", () => {
  for (const table of ["claimant_reviewer_identities", "claimant_reviewer_assignments",
    "claimant_reviewer_assignment_events", "claimant_reviewer_assignment_idempotency"]) {
    assert.ok(migration.includes(`create table public.${table}`), table);
  }
  assert.equal((migration.match(/force row level security/g) ?? []).length, 4);
  assert.equal((migration.match(/using \(false\) with check \(false\)/g) ?? []).length, 4);
  assert.match(migration, /synthetic_only boolean not null default true check \(synthetic_only\)/);
  assert.match(migration, /live_review_authority boolean not null default false check \(not live_review_authority\)/);
});

test("enforces separate active reviewers, slots, related-party denial, and cooldown completion", () => {
  assert.match(migration, /assignment_slot smallint not null check \(assignment_slot in \(1, 2\)\)/);
  assert.match(migration, /claimant_reviewer_active_slot_idx[\s\S]*where status = 'assigned'/);
  assert.match(migration, /claimant_reviewer_active_identity_idx[\s\S]*where status = 'assigned'/);
  assert.match(migration, /v_cycle\.cooldown_expires_at > now\(\)/);
  assert.match(migration, /v_reviewer\.user_id in \(v_case\.owner_user_id, v_case\.claimant_user_id\)/);
  assert.match(migration, /v_reviewer\.status <> 'active'/);
});

test("keeps append-only value-free events and stale-version/idempotency checks", () => {
  assert.match(migration, /metadata = '\{\}'::jsonb/);
  assert.doesNotMatch(migration,
    /grant[^;]*(update|delete)[^;]*claimant_reviewer_assignment_events/);
  assert.doesNotMatch(migration,
    /grant[^;]*(update|delete)[^;]*claimant_reviewer_assignment_idempotency/);
  assert.match(migration, /assignment_version <> p_expected_assignment_version/);
  assert.match(migration, /request_digest <> v_digest/);
  for (const event of ["reviewer_assigned", "reviewer_conflict_declared", "reviewer_recused"]) {
    assert.ok(migration.includes(event), event);
  }
});

test("keeps all functions security-invoker, service-only, and unmounted", () => {
  assert.equal((migration.match(/language plpgsql security invoker set search_path = ''/g) ?? []).length, 3);
  for (const fn of ["claimant_assign_reviewer", "claimant_declare_reviewer_conflict",
    "claimant_recuse_reviewer"]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*?from public, anon, authenticated`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*?to service_role`));
  }
  assert.doesNotMatch(migration, /security definer/);
  assert.match(service, /CLAIMANT_REVIEWER_ASSIGNMENT_APPROVED\s*=\s*false\s+as\s+const/);
  assert.doesNotMatch(index, /reviewer-assignment-service|reviewer-assignment-transaction-client/);
});

test("adds no reviewer decision, approval count, evidence access, or release predicate", () => {
  for (const source of [migration, service, client]) {
    for (const token of ["review_decisions", "record_review_decision", "evidence_object",
      "evidence_access", "release_package", "authorize_release", "fetch(", "localStorage"])
      assert.doesNotMatch(source, new RegExp(token.replace("(", "\\(")));
  }
  for (const safe of ["'reviewer_decision_recorded', false", "'approval_counted', false",
    "'release_authorized', false"]) assert.ok(migration.includes(safe), safe);
  assert.match(client, /reviewer_decision_recorded: z\.literal\(false\)/);
  assert.match(client, /approval_counted: z\.literal\(false\)/);
  assert.match(client, /release_authorized: z\.literal\(false\)/);
});
