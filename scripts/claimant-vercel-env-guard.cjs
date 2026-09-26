// Staging wiring W1 deploy-time guard. Claimant switches, offline-code V2 keys and Preview database credentials
// may exist only on the Vercel Preview scoped to the claimant-preview branch, never on Production, Development or
// an unscoped Preview. It reads variable names, targets and branch scopes only, never values.
const PREVIEW_BRANCH = "claimant-preview";
const PROJECTS = ["sanduqkin-api", "sanduqkin-web"];
const guarded = /^(CLAIMANT_|OFFLINE_CODE_V2_|EXPO_PUBLIC_OFFLINE_CODE_V2_)/u;
const previewCredentials = new Set(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

function findViolations(project, envs) {
  const violations = [];
  for (const entry of envs) {
    const targets = Array.isArray(entry.target) ? entry.target : [entry.target].filter(Boolean);
    const scoped = entry.gitBranch === PREVIEW_BRANCH;
    if (guarded.test(entry.key)) {
      if (targets.some((target) => target !== "preview"))
        violations.push(`${project}: ${entry.key} targets ${targets.join("+")}`);
      else if (!scoped) violations.push(`${project}: ${entry.key} is on every Preview, not only ${PREVIEW_BRANCH}`);
    }
    if (previewCredentials.has(entry.key) && targets.includes("preview") && !scoped)
      violations.push(`${project}: ${entry.key} reaches every Preview, not only ${PREVIEW_BRANCH}`);
  }
  return violations;
}

async function main() {
  const token = process.env.VERCEL_TOKEN?.trim();
  if (!token) {
    console.log("Claimant Vercel env guard skipped: VERCEL_TOKEN is not available.");
    return;
  }
  const team = process.env.VERCEL_TEAM_ID?.trim();
  const violations = [];
  for (const project of PROJECTS) {
    const url = new URL(`https://api.vercel.com/v9/projects/${project}/env`);
    if (team) url.searchParams.set("teamId", team);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Vercel env listing for ${project} failed with ${response.status}.`);
    const { envs } = await response.json();
    violations.push(...findViolations(project, (envs ?? []).map(({ key, target, gitBranch }) =>
      ({ key, target, gitBranch }))));
  }
  if (violations.length) throw new Error(`Claimant Vercel env guard failed:\n- ${violations.join("\n- ")}`);
  console.log(`Claimant Vercel env guard passed for ${PROJECTS.join(", ")}.`);
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exit(1); });

module.exports = { findViolations };
