const assert = require("node:assert/strict");
const test = require("node:test");

const { SYNTHETIC_EMAIL_PATTERN, cleanup, countSql, deleteSql } = require("./claimant-preview-synthetic-cleanup.cjs");

test("only reserved synthetic addresses match", () => {
  const pattern = new RegExp(SYNTHETIC_EMAIL_PATTERN, "u");
  assert.ok(pattern.test("claimant-preview-synthetic-0123456789ab@sanduqkin.invalid"));
  for (const email of ["admin@sanduqkin.com", "claimant-preview-synthetic-0123456789ab@sanduqkin.com",
    "claimant-preview-synthetic-0123456789ab@sanduqkin.invalid.example.com", "x-claimant-preview-synthetic-0123456789ab@sanduqkin.invalid",
    "claimant-preview-synthetic-0123456789AB@sanduqkin.invalid", "claimant-preview-synthetic-@sanduqkin.invalid"])
    assert.equal(pattern.test(email), false, email);
});

test("every delete is scoped through the synthetic users and runs in one transaction", () => {
  assert.match(deleteSql, /^begin;/u); assert.match(deleteSql, /commit;$/u);
  for (const statement of deleteSql.split(";").filter((part) => /\bdelete from\b/u.test(part)))
    assert.match(statement, /synthetic_(users|locators|challenges)/u, statement);
  assert.equal((deleteSql.match(/auth\.users where email ~/gu) ?? []).length, 1);
  assert.doesNotMatch(countSql, /\bdelete\b/u);
});

test("a dry run only reads", async () => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => { calls.push(JSON.parse(init.body));
    return { ok: true, json: async () => [{ users: 2, locators: 3, challenges: 4 }] }; };
  try {
    const counts = await cleanup({ apply: false, token: "t", projectRef: "ref", log: () => {} });
    assert.deepEqual(counts, { users: 2, locators: 3, challenges: 4 });
    assert.equal(calls.length, 1); assert.equal(calls[0].read_only, true);
  } finally { global.fetch = originalFetch; }
});
