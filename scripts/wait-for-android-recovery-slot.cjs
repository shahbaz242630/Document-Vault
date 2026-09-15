const activeStatuses = new Set(["in_progress", "pending", "queued", "requested", "waiting"]);
const workflowPath = "security-ci.yml";

function requireValue(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) throw new Error(`${label} is required.`);
  return value.trim();
}

async function readJson(url, token, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) throw new Error(`GitHub Actions read failed with status ${response.status}.`);
  return response.json();
}

async function findEarlierRecoveryJob({ repository, runId, token, fetchImpl = fetch }) {
  const root = `https://api.github.com/repos/${repository}/actions`;
  const runs = await readJson(`${root}/workflows/${workflowPath}/runs?per_page=100`, token, fetchImpl);
  const earlierRuns = (runs.workflow_runs ?? [])
    .filter((run) => run.event === "push" && Number(run.id) < runId && activeStatuses.has(run.status))
    .sort((left, right) => Number(left.id) - Number(right.id));

  for (const run of earlierRuns) {
    const jobs = await readJson(`${root}/runs/${run.id}/jobs?filter=latest&per_page=100`, token, fetchImpl);
    const job = (jobs.jobs ?? []).find(
      (candidate) => candidate.name === "Android emulator smoke" && activeStatuses.has(candidate.status),
    );
    if (job) return Object.freeze({ runId: Number(run.id), jobId: Number(job.id) });
  }
  return null;
}

async function waitForAndroidRecoverySlot(input) {
  const deadline = Date.now() + input.timeoutMs;
  while (Date.now() < deadline) {
    const blocker = await findEarlierRecoveryJob(input);
    if (!blocker) return;
    console.log(`Waiting for older Android recovery run ${blocker.runId}, job ${blocker.jobId}.`);
    await input.delay(input.pollMs);
  }
  throw new Error("Timed out waiting for the ordered Android recovery smoke slot.");
}

async function main() {
  const repository = requireValue(process.env.GITHUB_REPOSITORY, "GITHUB_REPOSITORY");
  const token = requireValue(process.env.GITHUB_TOKEN, "GITHUB_TOKEN");
  const runId = Number(requireValue(process.env.GITHUB_RUN_ID, "GITHUB_RUN_ID"));
  if (!Number.isSafeInteger(runId) || runId <= 0) throw new Error("GITHUB_RUN_ID must be a positive integer.");
  await waitForAndroidRecoverySlot({
    repository,
    runId,
    token,
    timeoutMs: 20 * 60 * 1_000,
    pollMs: 15_000,
    delay: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  });
  console.log("Android recovery smoke slot acquired.");
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Android recovery slot acquisition failed.");
  process.exitCode = 1;
});

module.exports = { findEarlierRecoveryJob, waitForAndroidRecoverySlot };
