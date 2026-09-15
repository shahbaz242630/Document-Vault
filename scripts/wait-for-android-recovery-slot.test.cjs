const assert = require("node:assert/strict");
const test = require("node:test");
const { findEarlierRecoveryJob, waitForAndroidRecoverySlot } = require("./wait-for-android-recovery-slot.cjs");

function response(value, ok = true, status = 200) {
  return { ok, status, json: async () => value };
}

test("selects the oldest active Android job from an earlier push run", async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url.includes("/workflows/")) return response({ workflow_runs: [
      { id: 12, event: "push", status: "in_progress" },
      { id: 11, event: "pull_request", status: "in_progress" },
      { id: 10, event: "push", status: "in_progress" },
    ] });
    if (url.includes("/runs/10/")) return response({ jobs: [
      { id: 100, name: "Android emulator smoke", status: "in_progress" },
    ] });
    throw new Error(`Unexpected request: ${url}`);
  };
  const blocker = await findEarlierRecoveryJob({
    repository: "owner/repo", runId: 13, token: "token", fetchImpl,
  });
  assert.deepEqual(blocker, { runId: 10, jobId: 100 });
  assert.equal(requests.length, 2);
});

test("ignores completed, pull-request, and newer runs", async () => {
  const fetchImpl = async (url) => {
    if (url.includes("/workflows/")) return response({ workflow_runs: [
      { id: 20, event: "push", status: "in_progress" },
      { id: 18, event: "pull_request", status: "in_progress" },
      { id: 17, event: "push", status: "completed" },
    ] });
    throw new Error(`Unexpected request: ${url}`);
  };
  assert.equal(await findEarlierRecoveryJob({
    repository: "owner/repo", runId: 19, token: "token", fetchImpl,
  }), null);
});

test("waits until the earlier recovery job completes", async () => {
  let attempts = 0;
  const delays = [];
  await waitForAndroidRecoverySlot({
    repository: "owner/repo",
    runId: 21,
    token: "token",
    timeoutMs: 10_000,
    pollMs: 25,
    delay: async (milliseconds) => { delays.push(milliseconds); },
    fetchImpl: async (url) => {
      if (url.includes("/workflows/")) {
        attempts += 1;
        return response({ workflow_runs: attempts === 1
          ? [{ id: 20, event: "push", status: "in_progress" }]
          : [{ id: 20, event: "push", status: "completed" }] });
      }
      return response({ jobs: [{ id: 200, name: "Android emulator smoke", status: "queued" }] });
    },
  });
  assert.deepEqual(delays, [25]);
});

test("fails closed when GitHub Actions cannot be read", async () => {
  await assert.rejects(findEarlierRecoveryJob({
    repository: "owner/repo",
    runId: 3,
    token: "token",
    fetchImpl: async () => response({}, false, 503),
  }), /status 503/);
});
