const { execFileSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");

function runClaimantRegisteredRecipientLifecycleDbTest(options = {}) {
  const id = Object.fromEntries([
    "owner", "claimant", "attacker", "issue", "accept", "enroll", "finalize",
    "replace", "revoke", "revokeInvite", "sessionKey", "grantOne", "grantTwo",
  ].map((name) => [name, randomUUID()]));
  const sql = `
begin;
insert into auth.users(id) values ('${id.owner}'), ('${id.claimant}'), ('${id.attacker}');
set local role service_role;
do $test$
declare
  v_issue jsonb; v_accept jsonb; v_enroll jsonb; v_finalize jsonb; v_replace jsonb;
  v_invitation uuid; v_case uuid; v_key_one uuid; v_key_two uuid; v_key_three uuid;
  v_grants jsonb; v_future timestamptz := date_trunc('second', now() + interval '1 day');
  v_revoked_invitation_blocked boolean := false;
begin
  v_issue := public.claimant_issue_registered_invitation('${id.owner}', repeat('a',64), v_future, '${id.issue}');
  v_invitation := (v_issue ->> 'invitation_id')::uuid;
  v_accept := public.claimant_accept_registered_invitation(v_invitation, '${id.claimant}', repeat('a',64), 1,
    repeat('b',64), jsonb_build_object('kty','EC','crv','P-256','x',repeat('A',43),'y',repeat('B',43)),
    'synthetic-policy', 1, '${id.accept}');
  v_case := (v_accept ->> 'case_id')::uuid;
  v_key_one := (v_accept ->> 'claimant_key_id')::uuid;

  v_enroll := public.claimant_manage_registered_recipient('enroll','${id.claimant}',v_case,1,null,
    repeat('c',64),jsonb_build_object('kty','EC','crv','P-256','x',repeat('C',43),'y',repeat('D',43)),null,'${id.enroll}');
  v_key_two := (v_enroll ->> 'claimant_key_id')::uuid;
  if (v_enroll ->> 'case_version')::integer <> 2 then raise exception 'second key did not advance case'; end if;

  begin
    perform public.claimant_manage_registered_recipient('enroll','${id.attacker}',v_case,2,null,
      repeat('d',64),jsonb_build_object('kty','EC','crv','P-256','x',repeat('E',43),'y',repeat('F',43)),null,'${randomUUID()}');
    raise exception 'cross-claimant enrollment succeeded';
  exception when insufficient_privilege then null;
  end;

  v_grants := jsonb_build_array(
    jsonb_build_object('protocol','sanduqkin:claim:recipient-grant:v2','profile','registered_recipient_v2',
      'key_agreement','p256_ecdh','kdf','hkdf_sha256','aead','xchacha20poly1305_ietf',
      'grant_id','${id.grantOne}','recipient_id','${id.claimant}','recipient_key_id',v_key_one,
      'recipient_key_version',1,'owner_ephemeral_public_key',repeat('G',87),'nonce',repeat('H',32),
      'ciphertext',repeat('I',64),'created_at',date_trunc('second',now()),'grant_version',1,'revoked_at',null),
    jsonb_build_object('protocol','sanduqkin:claim:recipient-grant:v2','profile','registered_recipient_v2',
      'key_agreement','p256_ecdh','kdf','hkdf_sha256','aead','xchacha20poly1305_ietf',
      'grant_id','${id.grantTwo}','recipient_id','${id.claimant}','recipient_key_id',v_key_two,
      'recipient_key_version',1,'owner_ephemeral_public_key',repeat('J',87),'nonce',repeat('K',32),
      'ciphertext',repeat('L',64),'created_at',date_trunc('second',now()),'grant_version',1,'revoked_at',null)
  );
  v_finalize := public.claimant_manage_registered_recipient('finalize','${id.owner}',v_case,2,null,null,null,v_grants,'${id.finalize}');
  if (v_finalize ->> 'finalization_version')::integer <> 1 then raise exception 'owner finalization failed'; end if;
  if (select count(*) from public.claimant_recipient_grants where case_id=v_case and status='active') <> 2 then
    raise exception 'finalization did not create two active grants';
  end if;

  v_replace := public.claimant_manage_registered_recipient('replace','${id.claimant}',v_case,3,v_key_one,
    repeat('e',64),jsonb_build_object('kty','EC','crv','P-256','x',repeat('M',43),'y',repeat('N',43)),null,'${id.replace}');
  v_key_three := (v_replace ->> 'claimant_key_id')::uuid;
  if exists(select 1 from public.claimant_cases where id=v_case and owner_finalized_at is not null) then
    raise exception 'replacement did not clear owner finalization';
  end if;
  if exists(select 1 from public.claimant_recipient_grants where case_id=v_case and status='active') then
    raise exception 'replacement did not revoke grants';
  end if;

  perform public.claimant_manage_registered_recipient('revoke','${id.claimant}',v_case,4,v_key_two,null,null,null,'${id.revoke}');
  begin
    perform public.claimant_manage_registered_recipient('revoke','${id.claimant}',v_case,5,v_key_three,null,null,null,'${randomUUID()}');
    raise exception 'last active key was revoked';
  exception when check_violation then null;
  end;

  v_issue := public.claimant_issue_registered_invitation('${id.owner}', repeat('f',64), v_future, '${id.sessionKey}');
  perform public.claimant_revoke_registered_invitation('${id.owner}',(v_issue->>'invitation_id')::uuid,1,'${id.revokeInvite}');
  begin
    perform public.claimant_accept_registered_invitation((v_issue->>'invitation_id')::uuid,'${id.attacker}',repeat('f',64),2,
      repeat('9',64),jsonb_build_object('kty','EC','crv','P-256','x',repeat('Q',43),'y',repeat('R',43)),
      'synthetic-policy',1,'${randomUUID()}');
  exception when raise_exception then v_revoked_invitation_blocked := true;
  end;
  if not v_revoked_invitation_blocked then raise exception 'revoked invitation was accepted'; end if;
end $test$;
rollback;
select 'CLAIMANT_REGISTERED_RECIPIENT_LIFECYCLE_DB_TEST_PASSED';`;
  const output = execFileSync("docker", ["exec", "-i", options.container ?? "supabase_db_supabase",
    "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"],
  { encoding: "utf8", input: sql });
  if (!output.includes("CLAIMANT_REGISTERED_RECIPIENT_LIFECYCLE_DB_TEST_PASSED")) throw new Error("Lifecycle DB test marker missing.");
}

if (require.main === module) {
  runClaimantRegisteredRecipientLifecycleDbTest();
  console.log("Claimant registered-recipient lifecycle database test passed.");
}
module.exports = { runClaimantRegisteredRecipientLifecycleDbTest };
