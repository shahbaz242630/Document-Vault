const assert = require("node:assert/strict");
const test = require("node:test");

const {
  readConfiguration,
  reportProcessorStatus,
} = require("./report-processor-status.cjs");

const baseConfiguration = {
  repository: "owner/repository",
  runId: "12345",
  serverUrl: "https://github.com",
  token: "test-token",
  processorName: "Account deletion processor",
  result: "failure",
};
const fixedNow = () => new Date("2026-07-15T10:00:00.000Z");

test("requires bounded processor status configuration", () => {
  assert.throws(() => readConfiguration({}), /Missing required processor status setting/);
  assert.throws(
    () => readConfiguration({
      GITHUB_REPOSITORY: "owner/repository",
      GITHUB_RUN_ID: "123",
      GITHUB_TOKEN: "token",
      PROCESSOR_NAME: "bad/name",
      PROCESSOR_RESULT: "failure",
    }),
    /unsupported characters/,
  );
});

test("creates one value-free incident for a new failure", async () => {
  const calls = [];
  const fetchImpl = createFetchMock(calls, [[], { number: 42 }]);

  const result = await reportProcessorStatus(baseConfiguration, { fetchImpl, now: fixedNow });

  assert.deepEqual(result, { action: "created", issueNumber: 42 });
  assert.equal(calls[0].init.method, undefined);
  const created = JSON.parse(calls[1].init.body);
  assert.equal(created.title, "[Operations] Account deletion processor failure");
  assert.match(created.body, /actions\/runs\/12345/);
  assert.match(created.body, /run metadata only/);
  assert.doesNotMatch(created.body, /test-token/);
});

test("comments on the existing incident instead of creating a duplicate", async () => {
  const calls = [];
  const fetchImpl = createFetchMock(calls, [
    [{ number: 7, title: "[Operations] Account deletion processor failure" }],
    { id: 99 },
  ]);

  const result = await reportProcessorStatus(baseConfiguration, { fetchImpl, now: fixedNow });

  assert.deepEqual(result, { action: "commented", issueNumber: 7 });
  assert.match(calls[1].url, /\/issues\/7\/comments$/);
  assert.equal(calls.length, 2);
});

test("closes an existing incident after a successful recovery run", async () => {
  const calls = [];
  const fetchImpl = createFetchMock(calls, [
    [{ number: 8, title: "[Operations] Account deletion processor failure" }],
    { id: 100 },
    { number: 8, state: "closed" },
  ]);

  const result = await reportProcessorStatus(
    { ...baseConfiguration, result: "success" },
    { fetchImpl, now: fixedNow },
  );

  assert.deepEqual(result, { action: "closed", issueNumber: 8 });
  assert.match(JSON.parse(calls[1].init.body).body, /completed successfully/);
  assert.deepEqual(JSON.parse(calls[2].init.body), {
    state: "closed",
    state_reason: "completed",
  });
});

test("does nothing after success when no incident is open", async () => {
  const calls = [];
  const result = await reportProcessorStatus(
    { ...baseConfiguration, result: "success" },
    { fetchImpl: createFetchMock(calls, [[]]), now: fixedNow },
  );

  assert.deepEqual(result, { action: "none" });
  assert.equal(calls.length, 1);
});

function createFetchMock(calls, responseBodies) {
  return async (url, init = {}) => {
    calls.push({ url, init });
    const body = responseBodies.shift();
    return {
      ok: true,
      status: 200,
      async json() {
        return body;
      },
    };
  };
}
