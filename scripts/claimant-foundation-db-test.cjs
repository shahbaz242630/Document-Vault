const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

const DEFAULT_CONTAINER = "supabase_db_supabase";

function runClaimantFoundationDbTest(options = {}) {
  const ids = {
    owner: randomUUID(),
    claimant: randomUUID(),
    otherClaimant: randomUUID(),
    invitation: randomUUID(),
    crossKeyInvitation: randomUUID(),
    key: randomUUID(),
    otherKey: randomUUID(),
    claim: randomUUID(),
  };

  const sql = `
begin;

insert into auth.users (id) values
  ('${ids.owner}'),
  ('${ids.claimant}'),
  ('${ids.otherClaimant}');

insert into public.claimant_identities (user_id, status) values
  ('${ids.owner}', 'active'),
  ('${ids.claimant}', 'active'),
  ('${ids.otherClaimant}', 'active');

insert into public.claimant_invitations (
  id,
  owner_user_id,
  recipient_address_digest,
  status,
  accepted_by_user_id,
  expires_at,
  accepted_at
) values
  (
    '${ids.invitation}',
    '${ids.owner}',
    repeat('a', 64),
    'accepted',
    '${ids.claimant}',
    now() + interval '1 day',
    now()
  ),
  (
    '${ids.crossKeyInvitation}',
    '${ids.owner}',
    repeat('b', 64),
    'accepted',
    '${ids.claimant}',
    now() + interval '1 day',
    now()
  );

insert into public.claimant_device_keys (
  id,
  claimant_user_id,
  device_binding_digest,
  public_key_jwk
) values
  (
    '${ids.key}',
    '${ids.claimant}',
    repeat('c', 64),
    jsonb_build_object('kty', 'EC', 'crv', 'P-256', 'x', repeat('A', 43), 'y', repeat('B', 43))
  ),
  (
    '${ids.otherKey}',
    '${ids.otherClaimant}',
    repeat('d', 64),
    jsonb_build_object('kty', 'EC', 'crv', 'P-256', 'x', repeat('C', 43), 'y', repeat('D', 43))
  );

insert into public.claimant_cases (
  id,
  claimant_user_id,
  owner_user_id,
  invitation_id,
  current_key_id,
  policy_pack_id,
  policy_pack_version
) values (
  '${ids.claim}',
  '${ids.claimant}',
  '${ids.owner}',
  '${ids.invitation}',
  '${ids.key}',
  'synthetic-policy-pack',
  1
);

do $test$
begin
  begin
    insert into public.claimant_invitations (
      owner_user_id,
      recipient_address_digest,
      status,
      accepted_by_user_id,
      expires_at,
      accepted_at
    ) values (
      '${ids.owner}',
      repeat('f', 64),
      'accepted',
      '${ids.owner}',
      now() + interval '1 day',
      now()
    );
    raise exception 'owner self-accepted a registered-recipient invitation';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.claimant_device_keys (
      claimant_user_id,
      device_binding_digest,
      public_key_jwk
    ) values (
      '${ids.claimant}',
      repeat('e', 64),
      jsonb_build_object(
        'kty', 'EC',
        'crv', 'P-256',
        'x', repeat('E', 43),
        'y', repeat('F', 43),
        'd', 'private-material-must-not-be-stored'
      )
    );
    raise exception 'private claimant key material was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.claimant_cases (
      claimant_user_id,
      owner_user_id,
      invitation_id,
      current_key_id,
      policy_pack_id,
      policy_pack_version
    ) values (
      '${ids.claimant}',
      '${ids.owner}',
      '${ids.crossKeyInvitation}',
      '${ids.otherKey}',
      'synthetic-policy-pack',
      1
    );
    raise exception 'cross-claimant device key was accepted';
  exception when foreign_key_violation then
    null;
  end;

  begin
    insert into public.claimant_cases (
      claimant_user_id,
      owner_user_id,
      invitation_id,
      current_key_id,
      policy_pack_id,
      policy_pack_version
    ) values (
      '${ids.claimant}',
      '${ids.owner}',
      '${ids.invitation}',
      '${ids.key}',
      'synthetic-policy-pack',
      1
    );
    raise exception 'single-use invitation created a second case';
  exception when unique_violation then
    null;
  end;
end
$test$;

select 'claimant_foundation_rows=' ||
  (select count(*) from public.claimant_identities) || ',' ||
  (select count(*) from public.claimant_invitations) || ',' ||
  (select count(*) from public.claimant_device_keys) || ',' ||
  (select count(*) from public.claimant_cases);

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

  if (!output.includes("claimant_foundation_rows=3,2,2,1")) {
    throw new Error(`Claimant foundation invariant test returned an unexpected result: ${output}`);
  }

  return { ok: true };
}

if (require.main === module) {
  try {
    runClaimantFoundationDbTest();
    console.log("Claimant foundation database invariant test passed.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = { runClaimantFoundationDbTest };
