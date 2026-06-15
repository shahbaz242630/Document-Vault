const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { runMobileSecretScan } = require("./mobile-secret-scan.cjs");

test("passes the repository mobile secret scan", () => {
  const result = runMobileSecretScan({ cwd: path.resolve(__dirname, "..") });

  assert.deepEqual(result, {
    findings: [],
    ok: true,
  });
});

test("fails when mobile source or generated bundle contains server-only material", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mobile-secret-scan-"));
  const sourceDir = path.join(tmp, "apps", "mobile", "src");
  const bundleDir = path.join(tmp, ".security", "mobile-export");

  fs.mkdirSync(sourceDir, { recursive: true });
  fs.mkdirSync(bundleDir, { recursive: true });
  fs.writeFileSync(
    path.join(sourceDir, "leaky.ts"),
    "export const bad = process.env.SUPABASE_SERVICE_ROLE_KEY;",
  );
  fs.writeFileSync(
    path.join(bundleDir, "index.js"),
    'const token = "eyJ0eXAiOiJKV1Q.InJvbGUiOiJzZXJ2aWNlX3JvbGUi.sig";',
  );

  const result = runMobileSecretScan({ cwd: tmp });

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings, [
    {
      path: "apps/mobile/src/leaky.ts",
      rule: "server-only-env-name",
    },
    {
      path: ".security/mobile-export/index.js",
      rule: "supabase-service-role-jwt",
    },
  ]);
});

test("allows the mobile Supabase config guard to mention service-role markers", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mobile-secret-scan-"));
  const sourceDir = path.join(tmp, "apps", "mobile", "src", "shared", "config");

  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(
    path.join(sourceDir, "supabase-env.ts"),
    'throw new Error("Mobile Supabase config must never include service role keys.");',
  );

  const result = runMobileSecretScan({ cwd: tmp });

  assert.deepEqual(result, {
    findings: [],
    ok: true,
  });
});

