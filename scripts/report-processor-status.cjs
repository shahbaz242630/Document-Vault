const API_VERSION = "2022-11-28";

function readConfiguration(env = process.env) {
  const configuration = {
    repository: env.GITHUB_REPOSITORY,
    runId: env.GITHUB_RUN_ID,
    serverUrl: env.GITHUB_SERVER_URL || "https://github.com",
    token: env.GITHUB_TOKEN,
    processorName: env.PROCESSOR_NAME,
    result: env.PROCESSOR_RESULT,
  };

  for (const [name, value] of Object.entries(configuration)) {
    if (!value) {
      throw new Error(`Missing required processor status setting: ${name}`);
    }
  }

  if (!/^[A-Za-z0-9 ._-]{1,80}$/.test(configuration.processorName)) {
    throw new Error("Processor name contains unsupported characters.");
  }

  if (!new Set(["success", "failure", "cancelled", "skipped"]).has(configuration.result)) {
    throw new Error(`Unsupported processor result: ${configuration.result}`);
  }

  return configuration;
}

async function reportProcessorStatus(configuration, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.now || (() => new Date());
  const title = `[Operations] ${configuration.processorName} failure`;
  const runUrl = `${configuration.serverUrl}/${configuration.repository}/actions/runs/${configuration.runId}`;
  const issue = await findOpenIssue(configuration, title, fetchImpl);

  if (configuration.result === "success") {
    if (!issue) {
      return { action: "none" };
    }

    await request(configuration, `/issues/${issue.number}/comments`, fetchImpl, {
      method: "POST",
      body: JSON.stringify({
        body: recoveryMessage(configuration, runUrl, now()),
      }),
    });
    await request(configuration, `/issues/${issue.number}`, fetchImpl, {
      method: "PATCH",
      body: JSON.stringify({ state: "closed", state_reason: "completed" }),
    });
    return { action: "closed", issueNumber: issue.number };
  }

  const message = failureMessage(configuration, runUrl, now());
  if (issue) {
    await request(configuration, `/issues/${issue.number}/comments`, fetchImpl, {
      method: "POST",
      body: JSON.stringify({ body: message }),
    });
    return { action: "commented", issueNumber: issue.number };
  }

  const created = await request(configuration, "/issues", fetchImpl, {
    method: "POST",
    body: JSON.stringify({ title, body: message }),
  });
  return { action: "created", issueNumber: created.number };
}

async function findOpenIssue(configuration, title, fetchImpl) {
  const issues = await request(
    configuration,
    "/issues?state=open&per_page=100",
    fetchImpl,
  );
  return issues.find((issue) => !issue.pull_request && issue.title === title);
}

async function request(configuration, path, fetchImpl, init = {}) {
  const response = await fetchImpl(
    `https://api.github.com/repos/${configuration.repository}${path}`,
    {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${configuration.token}`,
        "X-GitHub-Api-Version": API_VERSION,
        ...init.headers,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub issue API request failed with status ${response.status}.`);
  }

  if (response.status === 204) {
    return undefined;
  }
  return response.json();
}

function failureMessage(configuration, runUrl, detectedAt) {
  return [
    `The scheduled **${configuration.processorName}** job did not complete successfully.`,
    "",
    `- Result: \`${configuration.result}\``,
    `- Run: [GitHub Actions run](${runUrl})`,
    `- Detected at: \`${detectedAt.toISOString()}\``,
    "",
    "This incident intentionally contains run metadata only. Processor response bodies, credentials, and user data are excluded.",
  ].join("\n");
}

function recoveryMessage(configuration, runUrl, recoveredAt) {
  return [
    `A later **${configuration.processorName}** run completed successfully.`,
    "",
    `- Recovery run: [GitHub Actions run](${runUrl})`,
    `- Recovered at: \`${recoveredAt.toISOString()}\``,
    "",
    "Closing this operational incident automatically.",
  ].join("\n");
}

async function main() {
  const result = await reportProcessorStatus(readConfiguration());
  console.log(`Processor status report action: ${result.action}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Processor status reporting failed.");
    process.exitCode = 1;
  });
}

module.exports = {
  failureMessage,
  readConfiguration,
  recoveryMessage,
  reportProcessorStatus,
};
