// Staging wiring W1: removes the synthetic claimant-preview owners and every offline-code V2 row they own from
// the shared Supabase project. It can only ever touch users on the reserved synthetic address pattern, which is
// written into the SQL itself, so no caller input can widen it. It is a required go-live step
// (docs/release-checklist.md). Dry run by default; pass --apply to delete.
//
// Rows left behind by design: rate-limit buckets (keyed digests, no user link) and decoy challenge idempotency
// results for revoked or unknown sheets (random values with no user link).
const SYNTHETIC_EMAIL_PATTERN = String.raw`^claimant-preview-synthetic-[0-9a-f]{12}@sanduqkin\.invalid$`;

const selectUsers = `select id from auth.users where email ~ '${SYNTHETIC_EMAIL_PATTERN}'`;
const selectLocators = `select id from public.claimant_offline_code_v2_locators where owner_user_id in (${selectUsers})`;
const selectChallenges = `select id from public.claimant_offline_code_v2_challenges where locator_record_id in (${selectLocators})`;

const countSql = `select
  (select count(*) from (${selectUsers}) u)::int as users,
  (select count(*) from (${selectLocators}) l)::int as locators,
  (select count(*) from (${selectChallenges}) c)::int as challenges`;

const deleteSql = `begin;
create temporary table synthetic_users on commit drop as ${selectUsers};
create temporary table synthetic_locators on commit drop as
  select id from public.claimant_offline_code_v2_locators where owner_user_id in (select id from synthetic_users);
create temporary table synthetic_challenges on commit drop as
  select id from public.claimant_offline_code_v2_challenges where locator_record_id in (select id from synthetic_locators);
delete from public.claimant_offline_code_v2_events where locator_record_id in (select id from synthetic_locators);
delete from public.claimant_offline_code_v2_attempts where locator_record_id in (select id from synthetic_locators);
delete from public.claimant_offline_code_v2_idempotency
  where scope_id in (select id from synthetic_locators union all select id from synthetic_challenges)
     or (operation = 'issue_challenge' and exists (select 1 from synthetic_locators l
       where result::text like '%' || l.id::text || '%'));
delete from public.claimant_offline_code_v2_challenges where id in (select id from synthetic_challenges);
delete from public.claimant_offline_code_v2_locators where id in (select id from synthetic_locators);
delete from auth.users where id in (select id from synthetic_users);
commit;`;

async function runQuery(query, { token, projectRef, readOnly }) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, read_only: readOnly }),
  });
  if (!response.ok) throw new Error(`Supabase query failed with ${response.status}: ${await response.text()}`);
  return response.json();
}

async function cleanup({ apply, token, projectRef, log = console.log }) {
  if (!token || !projectRef) throw new Error("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are required.");
  const [before] = await runQuery(countSql, { token, projectRef, readOnly: true });
  log(`Synthetic claimant-preview data: ${JSON.stringify(before)}${apply ? "" : " (dry run, nothing deleted)"}`);
  if (!apply) return before;
  await runQuery(deleteSql, { token, projectRef, readOnly: false });
  const [after] = await runQuery(countSql, { token, projectRef, readOnly: true });
  if (after.users || after.locators || after.challenges)
    throw new Error(`Synthetic claimant-preview data remains: ${JSON.stringify(after)}`);
  log("Synthetic claimant-preview data removed.");
  return after;
}

if (require.main === module) {
  cleanup({ apply: process.argv.includes("--apply"), token: process.env.SUPABASE_ACCESS_TOKEN?.trim(),
    projectRef: process.env.SUPABASE_PROJECT_REF?.trim() })
    .catch((error) => { console.error(error.message); process.exit(1); });
}

module.exports = { SYNTHETIC_EMAIL_PATTERN, cleanup, countSql, deleteSql };
