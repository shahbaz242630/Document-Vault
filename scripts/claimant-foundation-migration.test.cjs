const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const test = require("node:test");

const migration = readFileSync(
  "supabase/migrations/20260804134000_claimant_registered_recipient_foundation.sql",
  "utf8",
);

const tables = [
  "claimant_identities",
  "claimant_invitations",
  "claimant_device_keys",
  "claimant_cases",
];

test("creates a default-deny registered-recipient foundation", () => {
  for (const table of tables) {
    assert.match(migration, new RegExp(`create table public\\.${table}\\b`, "u"));
    assert.match(
      migration,
      new RegExp(`revoke all on table public\\.${table} from public`, "u"),
    );
    assert.match(
      migration,
      new RegExp(`revoke all on table public\\.${table} from anon`, "u"),
    );
    assert.match(
      migration,
      new RegExp(`revoke all on table public\\.${table} from authenticated`, "u"),
    );
    assert.match(
      migration,
      new RegExp(`grant all on table public\\.${table} to service_role`, "u"),
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} enable row level security`, "u"),
    );
    assert.match(
      migration,
      new RegExp(`alter table public\\.${table} force row level security`, "u"),
    );
  }

  assert.doesNotMatch(migration, /grant\s+.+\s+to\s+(?:anon|authenticated)\b/iu);
  assert.equal((migration.match(/using \(false\)/gu) ?? []).length, tables.length);
  assert.equal((migration.match(/with check \(false\)/gu) ?? []).length, tables.length);
});

test("stores only an address digest and public claimant key material", () => {
  assert.match(migration, /recipient_address_digest\s+text\s+not null/iu);
  assert.doesNotMatch(migration, /recipient_(?:email|address)\s+text/iu);
  assert.match(migration, /not \(public_key_jwk \? 'd'\)/u);
  assert.match(migration, /algorithm = 'p256_ecdh'/u);
  assert.doesNotMatch(migration, /private_key|recovery_key|complete_secret/iu);
});

test("binds each registered-recipient case to the accepted invitation and claimant key", () => {
  assert.match(migration, /invitation_status\s+text\s+not null default 'accepted'/u);
  assert.match(
    migration,
    /invitation_id,\s+owner_user_id,\s+claimant_user_id,\s+invitation_status[\s\S]+references public\.claimant_invitations/iu,
  );
  assert.match(
    migration,
    /foreign key \(current_key_id, claimant_user_id\)[\s\S]+references public\.claimant_device_keys/iu,
  );
  assert.match(migration, /unique \(invitation_id\)/u);
  assert.match(migration, /check \(claimant_user_id <> owner_user_id\)/u);
  assert.match(
    migration,
    /claimant_invitations_no_self_accept_check check \([\s\S]*accepted_by_user_id is null or accepted_by_user_id <> owner_user_id/iu,
  );
});
