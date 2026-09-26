const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");

const migrations = join(__dirname, "../supabase/migrations");
const read = (name) => readFileSync(join(migrations, name), "utf8");
const migration = read("20260926100000_claimant_single_approver_review.sql");
const functionBody = (source, name, create = "create function") => {
  const start = source.indexOf(`${create} public.${name}(`);
  assert.ok(start >= 0, name);
  return source.slice(start, source.indexOf("end $function$;", start) + "end $function$;".length);
};
const OLD_CONDITION = `    or v_round.id is null or v_round.status <> 'two_person_approved'
    or not v_round.two_person_approval_satisfied or v_round.release_authorized`;

test("keeps every new object service-only, security-invoker and synthetic-only", () => {
  assert.equal(migration.includes("security definer"), false);
  const created = [...migration.matchAll(/create (?:or replace )?function public\.(\w+)\(/gu)].map((m) => m[1]);
  assert.equal(new Set(created).size, created.length);
  for (const name of created) {
    assert.match(functionBody(migration, name, migration.includes(`create or replace function public.${name}(`)
      ? "create or replace function" : "create function"), /security invoker set search_path = ''/u, name);
    if (!["claimant_prepare_encrypted_release_package", "claimant_finalize_signed_release_package"].includes(name))
      assert.match(migration, new RegExp(`revoke all on function public\\.${name}\\([^)]*\\)\\s*from public, anon, authenticated`, "u"), name);
  }
  for (const table of ["claimant_review_policies", "claimant_review_prechecks", "claimant_single_approval_windows",
    "claimant_single_approval_events", "claimant_single_approval_idempotency", "claimant_review_audit_chain"]) {
    assert.ok(migration.includes(`alter table public.${table} force row level security;`), table);
    for (const role of ["public", "anon", "authenticated"])
      assert.ok(migration.includes(`revoke all on table public.${table} from ${role};`), `${table} ${role}`);
    assert.match(migration, new RegExp(`on public\\.${table} for all to anon, authenticated\\s+using \\(false\\) with check \\(false\\)`, "u"), table);
  }
  assert.match(migration, /synthetic_only boolean not null default true check \(synthetic_only\)/u);
  assert.equal(/live_(review|release)_authority boolean not null default true/u.test(migration), false);
});

test("fixes the single-approver safeguards the owner approved", () => {
  assert.match(migration, /min_cooldown_seconds >= 2592000 and dispute_window_seconds >= 604800/u);
  assert.match(migration, /dispute_window_seconds integer not null check \(dispute_window_seconds between 604800 and 2592000\)/u);
  const decision = functionBody(migration, "claimant_record_single_approver_decision");
  assert.ok(decision.includes("or (p_decision = 'allow' and v_precheck.outcome <> 'clear') then"));
  assert.ok(decision.includes("v_reviewer.reviewer_class <> 'accountable_human_test'"));
  assert.ok(decision.includes("v_assignment.assignment_slot <> 1"));
  const release = functionBody(migration, "claimant_authorize_single_approver_release");
  for (const token of ["v_window.window_expires_at > now()", "v_precheck.recorded_at < v_window.window_expires_at",
    "v_precheck.outcome <> 'clear'", "v_authority.user_id <> v_reviewer.user_id",
    "p_fresh_assurance_at < now() - interval '600 seconds'", "claimant_review_interventions intervention",
    "public.claimant_recipient_keys_current(p_case_id)", "v_window.notice_status <> 'delivery_verified'"])
    assert.ok(release.includes(token), token);
  assert.equal(/override/iu.test(decision + release), false);
});

test("lets the server alone choose an immutable review mode", () => {
  const guard = functionBody(migration, "claimant_enforce_review_round_mode");
  assert.ok(guard.includes("Review mode is immutable."));
  assert.ok(guard.includes("coalesce(v_mode, 'two_person') <> new.review_mode"));
  assert.match(migration, /before insert or update on public\.claimant_review_rounds/u);
});

test("chains every review, intervention, release and single-approval event", () => {
  for (const table of ["claimant_reviewer_assignment_events", "claimant_review_events",
    "claimant_review_intervention_events", "claimant_release_authorization_events", "claimant_single_approval_events"])
    assert.match(migration, new RegExp(`after insert on public\\.${table}\\s+for each row execute function public\\.claimant_append_review_audit_entry\\(\\)`, "u"), table);
  for (const name of ["claimant_append_review_audit_entry", "claimant_verify_review_audit_chain",
    "claimant_export_review_audit"])
    assert.ok(functionBody(migration, name).includes("set timezone = 'UTC'"), name);
  const exported = functionBody(migration, "claimant_export_review_audit");
  assert.equal(/reason_class|metadata|digest\(/u.test(exported), false);
});

test("changes the 4B and 4C functions in exactly one condition and nothing else", () => {
  for (const [file, name] of [["20260818190000_claimant_encrypted_package_foundation.sql",
    "claimant_prepare_encrypted_release_package"], ["20260818200000_claimant_signed_manifest_foundation.sql",
    "claimant_finalize_signed_release_package"]]) {
    const original = functionBody(read(file), name);
    const patched = functionBody(migration, name, "create or replace function");
    assert.equal(original.split(OLD_CONDITION).length, 2, name);
    const [before, after] = original.replace("create function", "create or replace function").split(OLD_CONDITION);
    assert.ok(patched.startsWith(before) && patched.endsWith(after), name);
    const replacement = patched.slice(before.length, patched.length - after.length);
    assert.ok(replacement.includes("v_authorization.review_mode = 'two_person'"), name);
    assert.ok(replacement.includes("v_authorization.review_mode = 'single_approver'"), name);
    assert.ok(replacement.includes("or v_round.release_authorized"), name);
  }
});
