const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const DEFAULT_CONTAINER = "supabase_db_supabase";

function runClaimantRegisteredRecipientMutationsDbTest(options = {}) {
  const ids = {
    owner: randomUUID(),
    claimant: randomUUID(),
    issueKey: randomUUID(),
    acceptKey: randomUUID(),
    selfIssueKey: randomUUID(),
  };

  const sql = `
begin;

insert into auth.users (id) values
  ('${ids.owner}'),
  ('${ids.claimant}');

set local role service_role;

do $test$
declare
  v_issue jsonb;
  v_issue_replay jsonb;
  v_self_issue jsonb;
  v_accept jsonb;
  v_accept_replay jsonb;
  v_invitation_id uuid;
  v_self_invitation_id uuid;
  v_future_expiry timestamptz := date_trunc('second', now() + interval '1 day');
begin
  v_issue := public.claimant_issue_registered_invitation(
    '${ids.owner}',
    repeat('a', 64),
    v_future_expiry,
    '${ids.issueKey}'
  );
  if (v_issue ->> 'replayed')::boolean then
    raise exception 'first invitation issue was marked as replayed';
  end if;
  v_invitation_id := (v_issue ->> 'invitation_id')::uuid;

  v_issue_replay := public.claimant_issue_registered_invitation(
    '${ids.owner}',
    repeat('a', 64),
    v_future_expiry,
    '${ids.issueKey}'
  );
  if not (v_issue_replay ->> 'replayed')::boolean
    or v_issue_replay ->> 'invitation_id' <> v_issue ->> 'invitation_id' then
    raise exception 'invitation issue replay did not return the original result';
  end if;

  begin
    perform public.claimant_issue_registered_invitation(
      '${ids.owner}',
      repeat('b', 64),
      v_future_expiry,
      '${ids.issueKey}'
    );
    raise exception 'idempotency key accepted changed invitation input';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.claimant_accept_registered_invitation(
      v_invitation_id,
      '${ids.claimant}',
      repeat('a', 64),
      2,
      repeat('c', 64),
      jsonb_build_object('kty', 'EC', 'crv', 'P-256', 'x', repeat('A', 43), 'y', repeat('B', 43)),
      'synthetic-policy-pack',
      1,
      '${randomUUID()}'
    );
    raise exception 'stale invitation version was accepted';
  exception when serialization_failure then
    null;
  end;

  begin
    perform public.claimant_accept_registered_invitation(
      v_invitation_id,
      '${ids.claimant}',
      repeat('b', 64),
      1,
      repeat('c', 64),
      jsonb_build_object('kty', 'EC', 'crv', 'P-256', 'x', repeat('A', 43), 'y', repeat('B', 43)),
      'synthetic-policy-pack',
      1,
      '${randomUUID()}'
    );
    raise exception 'mismatched invitation digest was accepted';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.claimant_accept_registered_invitation(
      v_invitation_id,
      '${ids.claimant}',
      repeat('a', 64),
      1,
      repeat('c', 64),
      jsonb_build_object(
        'kty', 'EC',
        'crv', 'P-256',
        'x', repeat('A', 43),
        'y', repeat('B', 43),
        'd', 'private-material-must-not-be-stored'
      ),
      'synthetic-policy-pack',
      1,
      '${randomUUID()}'
    );
    raise exception 'private claimant key material was accepted';
  exception when check_violation then
    null;
  end;

  if exists (
    select 1 from public.claimant_identities where user_id = '${ids.claimant}'
  ) or exists (
    select 1 from public.claimant_cases where claimant_user_id = '${ids.claimant}'
  ) or exists (
    select 1 from public.claimant_device_keys where claimant_user_id = '${ids.claimant}'
  ) then
    raise exception 'failed acceptance left partial claimant state';
  end if;

  v_self_issue := public.claimant_issue_registered_invitation(
    '${ids.owner}',
    repeat('d', 64),
    v_future_expiry,
    '${ids.selfIssueKey}'
  );
  v_self_invitation_id := (v_self_issue ->> 'invitation_id')::uuid;

  begin
    perform public.claimant_accept_registered_invitation(
      v_self_invitation_id,
      '${ids.owner}',
      repeat('d', 64),
      1,
      repeat('e', 64),
      jsonb_build_object('kty', 'EC', 'crv', 'P-256', 'x', repeat('C', 43), 'y', repeat('D', 43)),
      'synthetic-policy-pack',
      1,
      '${randomUUID()}'
    );
    raise exception 'owner self-accepted an invitation';
  exception when check_violation then
    null;
  end;

  v_accept := public.claimant_accept_registered_invitation(
    v_invitation_id,
    '${ids.claimant}',
    repeat('a', 64),
    1,
    repeat('c', 64),
    jsonb_build_object('kty', 'EC', 'crv', 'P-256', 'x', repeat('A', 43), 'y', repeat('B', 43)),
    'synthetic-policy-pack',
    1,
    '${ids.acceptKey}'
  );
  if (v_accept ->> 'replayed')::boolean then
    raise exception 'first invitation acceptance was marked as replayed';
  end if;

  v_accept_replay := public.claimant_accept_registered_invitation(
    v_invitation_id,
    '${ids.claimant}',
    repeat('a', 64),
    1,
    repeat('c', 64),
    jsonb_build_object('kty', 'EC', 'crv', 'P-256', 'x', repeat('A', 43), 'y', repeat('B', 43)),
    'synthetic-policy-pack',
    1,
    '${ids.acceptKey}'
  );
  if not (v_accept_replay ->> 'replayed')::boolean
    or v_accept_replay ->> 'case_id' <> v_accept ->> 'case_id' then
    raise exception 'invitation acceptance replay did not return the original result';
  end if;

  begin
    perform public.claimant_accept_registered_invitation(
      v_invitation_id,
      '${ids.claimant}',
      repeat('a', 64),
      1,
      repeat('c', 64),
      jsonb_build_object('kty', 'EC', 'crv', 'P-256', 'x', repeat('A', 43), 'y', repeat('B', 43)),
      'synthetic-policy-pack',
      2,
      '${ids.acceptKey}'
    );
    raise exception 'idempotency key accepted changed acceptance input';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    update public.claimant_audit_events set metadata = '{}'::jsonb;
    raise exception 'append-only claimant audit event was mutable';
  exception when insufficient_privilege then
    null;
  end;

  if (select count(*) from public.claimant_idempotency_records) <> 3
    or (select count(*) from public.claimant_audit_events) <> 5
    or (select count(*) from public.claimant_outbox) <> 3
    or (select count(*) from public.claimant_identities) <> 1
    or (select count(*) from public.claimant_device_keys) <> 1
    or (select count(*) from public.claimant_cases) <> 1 then
    raise exception 'mutation transaction counts were inconsistent';
  end if;
end
$test$;

select 'claimant_mutations=passed';

rollback;
`;

  const output = execFileSync(
    "docker",
    [
      "exec",
      "-i",
      options.container ?? DEFAULT_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qAt",
    ],
    { encoding: "utf8", input: sql },
  );

  if (!output.includes("claimant_mutations=passed")) {
    throw new Error(`Claimant mutation test returned an unexpected result: ${output}`);
  }

  return { ok: true };
}

if (require.main === module) {
  try {
    runClaimantRegisteredRecipientMutationsDbTest();
    console.log("Claimant registered-recipient mutation test passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { runClaimantRegisteredRecipientMutationsDbTest };
