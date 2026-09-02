const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const DEFAULT_CONTAINER = "supabase_db_supabase";
const digest = (character) => `${character.repeat(42)}Q`;

function buildOfflineCodeV2CaseBindingDbTestSql() {
  const id = Object.fromEntries([
    "owner", "claimant", "other", "session", "otherSession", "locator", "challenge",
    "grant", "case", "otherCase", "key", "otherKey",
  ].map((name) => [name, randomUUID()]));
  return `begin;
insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}'), ('${id.other}');
insert into public.claimant_portal_eligibilities(user_id, status, source)
values ('${id.claimant}', 'eligible', 'synthetic_fixture'),
  ('${id.other}', 'eligible', 'synthetic_fixture');
insert into public.claimant_portal_session_controls(user_id, active_session_id, status,
  assurance_level, authenticated_at)
values ('${id.claimant}', '${id.session}', 'active', 'aal2', now()),
  ('${id.other}', '${id.otherSession}', 'active', 'aal2', now());
insert into public.claimant_offline_code_v2_locators(id, owner_user_id, locator_index_digest,
  locator_commitment, grant_id, proof_public_key, record_binding_digest, wrap_nonce,
  wrap_ciphertext, wrap_associated_data_digest, issued_at, expires_at)
values ('${id.locator}', '${id.owner}', '${digest("L")}', '${digest("C")}', '${id.grant}',
  '${digest("P")}', '${digest("B")}', '${"N".repeat(32)}', '${"W".repeat(64)}',
  '${digest("A")}', now(), now() + interval '30 days');
insert into public.claimant_offline_code_v2_challenges(id, locator_record_id, locator_version,
  locator_commitment, proof_key_version, proof_public_key, record_binding_digest,
  challenge_bytes_base64url, challenge_bytes_digest, origin, nonce, status,
  issued_at, expires_at, terminal_at)
values ('${id.challenge}', '${id.locator}', 2, '${digest("C")}', 1, '${digest("P")}',
  '${digest("B")}', '${"Q".repeat(80)}', '${digest("D")}',
  'https://claim.synthetic.test', '${digest("N")}', 'verified', now(),
  now() + interval '5 minutes', now());
set local role service_role;
do $test$
declare v_result jsonb; v_case public.claimant_cases%rowtype;
begin
  update public.claimant_portal_session_controls set active_session_id = '${randomUUID()}'
  where user_id = '${id.claimant}';
  begin
    perform public.claimant_bind_offline_code_v2_case('${id.case}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.key}');
    raise exception 'displaced portal session was accepted';
  exception when sqlstate '28000' then null; end;
  update public.claimant_portal_session_controls set active_session_id = '${id.session}'
  where user_id = '${id.claimant}';
  update public.claimant_offline_code_v2_challenges set status = 'failed'
  where id = '${id.challenge}';
  begin
    perform public.claimant_bind_offline_code_v2_case('${id.case}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.key}');
    raise exception 'non-verified challenge was accepted';
  exception when sqlstate '42501' then null; end;
  update public.claimant_offline_code_v2_challenges set status = 'verified'
  where id = '${id.challenge}';
  update public.claimant_offline_code_v2_locators set status = 'revoked', revoked_at = now(),
    terminal_reason = 'owner_revoked' where id = '${id.locator}';
  begin
    perform public.claimant_bind_offline_code_v2_case('${id.case}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.key}');
    raise exception 'revoked locator was accepted';
  exception when sqlstate '42501' then null; end;
  update public.claimant_offline_code_v2_locators set status = 'active', revoked_at = null,
    terminal_reason = null where id = '${id.locator}';
  v_result := public.claimant_bind_offline_code_v2_case('${id.case}', '${id.claimant}',
    '${id.session}', '${id.challenge}', '${digest("B")}',
    'synthetic_policy_death_alpha', 1, '${id.key}');
  if v_result ->> 'route_profile' <> 'offline_code_v2'
    or v_result ->> 'authority' <> 'route_possession_only'
    or not (v_result ->> 'claimant_session_bound')::boolean
    or not (v_result ->> 'case_created')::boolean
    or (v_result ->> 'identity_verified')::boolean
    or (v_result ->> 'relationship_verified')::boolean
    or (v_result ->> 'intake_started')::boolean
    or (v_result ->> 'review_started')::boolean
    or (v_result ->> 'release_authorized')::boolean then
    raise exception 'case binding result exceeded possession authority';
  end if;
  select * into v_case from public.claimant_cases where id = '${id.case}';
  if v_case.state <> 'draft' or v_case.version <> 1
    or v_case.claimant_user_id <> '${id.claimant}'
    or v_case.owner_user_id <> '${id.owner}'
    or v_case.invitation_id is not null or v_case.current_key_id is not null
    or v_case.offline_code_v2_locator_record_id <> '${id.locator}'
    or v_case.offline_code_v2_challenge_id <> '${id.challenge}'
    or v_case.offline_code_v2_portal_session_id <> '${id.session}' then
    raise exception 'case binding persistence was incoherent';
  end if;
  if not (public.claimant_bind_offline_code_v2_case('${id.case}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.key}') ->> 'replayed')::boolean then
    raise exception 'case binding replay was unstable';
  end if;
  begin
    perform public.claimant_bind_offline_code_v2_case('${randomUUID()}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.key}');
    raise exception 'changed idempotency input was accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.claimant_bind_offline_code_v2_case('${id.otherCase}', '${id.other}',
      '${id.otherSession}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${id.otherKey}');
    raise exception 'verified challenge rebound to another account';
  exception when sqlstate '40001' then null; end;
  update public.claimant_portal_session_controls
  set authenticated_at = now() - interval '11 minutes' where user_id = '${id.claimant}';
  begin
    perform public.claimant_bind_offline_code_v2_case('${randomUUID()}', '${id.claimant}',
      '${id.session}', '${id.challenge}', '${digest("B")}',
      'synthetic_policy_death_alpha', 1, '${randomUUID()}');
    raise exception 'stale portal session was accepted';
  exception when sqlstate '28000' then null; end;
  if (select count(*) from public.claimant_cases where route_profile = 'offline_code_v2') <> 1
    or (select count(*) from public.claimant_audit_events
      where event_type = 'offline_code_v2_case_bound') <> 1
    or (select count(*) from public.claimant_offline_code_v2_events
      where event_type = 'case_bound') <> 1 then
    raise exception 'case binding facts were not exactly once';
  end if;
end $test$;
reset role;
set local role authenticated;
do $denied$ begin
  begin perform 1 from public.claimant_cases where id = '${id.case}';
    raise exception 'authenticated role read offline-code case';
  exception when insufficient_privilege then null; end;
  begin perform public.claimant_bind_offline_code_v2_case('${randomUUID()}', '${id.claimant}',
    '${id.session}', '${id.challenge}', '${digest("B")}',
    'synthetic_policy_death_alpha', 1, '${randomUUID()}');
    raise exception 'authenticated role called case binding RPC';
  exception when insufficient_privilege then null; end;
end $denied$;
reset role;
rollback;
select 'CLAIMANT_OFFLINE_CODE_V2_CASE_BINDING_DB_TEST_PASSED';`;
}

function runOfflineCodeV2CaseBindingDbTest(options = {}) {
  const output = execFileSync("docker", ["exec", "-i", options.container ?? DEFAULT_CONTAINER,
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: buildOfflineCodeV2CaseBindingDbTestSql() });
  if (!output.includes("CLAIMANT_OFFLINE_CODE_V2_CASE_BINDING_DB_TEST_PASSED"))
    throw new Error("Offline-code V2 case binding DB marker was missing.");
}

if (require.main === module) {
  const flag = process.argv.indexOf("--container");
  runOfflineCodeV2CaseBindingDbTest({
    container: flag >= 0 ? process.argv[flag + 1] : undefined,
  });
  console.log("Claimant offline-code V2 case binding DB test passed.");
}

module.exports = { buildOfflineCodeV2CaseBindingDbTestSql,
  runOfflineCodeV2CaseBindingDbTest };
