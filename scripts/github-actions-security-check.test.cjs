const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const YAML = require("yaml");

const { runGitHubActionsSecurityCheck } = require("./github-actions-security-check.cjs");

test("passes the repository GitHub Actions security check", () => {
  const result = runGitHubActionsSecurityCheck({ cwd: path.resolve(__dirname, "..") });

  assert.deepEqual(result, {
    ok: true,
    violations: [],
  });
});

test("runs every security guard regression suite in Security CI", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  for (const testFile of [
    "scripts/security-check.test.cjs",
    "scripts/mobile-secret-scan.test.cjs",
    "scripts/supabase-db-security-check.test.cjs",
    "scripts/github-actions-security-check.test.cjs",
    "scripts/phase1-dod-check.test.cjs",
  ]) {
    assert.match(workflow, new RegExp(`node --test[^\\n]*${testFile.replaceAll(".", "\\.")}`));
  }
});

test("runs Expo Doctor in Security CI", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  assert.match(workflow, /- name: Expo Doctor[\s\S]*?run: npm run doctor --workspace @vault\/mobile/);
});

test("parses every repository workflow as valid YAML", () => {
  const workflowDirectory = path.resolve(__dirname, "..", ".github", "workflows");

  for (const fileName of fs.readdirSync(workflowDirectory)) {
    if (/\.ya?ml$/i.test(fileName)) {
      YAML.parse(fs.readFileSync(path.join(workflowDirectory, fileName), "utf8"));
    }
  }
});

test("runs Android native compilation as a separate bounded Security CI job", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  assert.match(workflow, /android-native-compile:\s*\n\s*name: Android native compile/);
  assert.match(
    workflow,
    /android-native-compile:[\s\S]*?timeout-minutes: 45[\s\S]*?npx expo prebuild --platform android --no-install[\s\S]*?actions\/setup-java@[a-f0-9]{40}/,
  );
  assert.match(
    workflow,
    /android-native-compile:[\s\S]*?working-directory: apps\/mobile\/android[\s\S]*?\.\/gradlew app:assembleDebug/,
  );
  assert.match(
    workflow,
    /android-native-compile:[\s\S]*?-PreactNativeArchitectures=x86_64/,
  );
  assert.match(workflow, /\$ANDROID_HOME\/cmdline-tools\/latest\/bin\/sdkmanager/);
});

test("builds and launches an unsigned iOS release in a bounded macOS simulator job", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );
  const iosJob = workflow.match(/  ios-simulator-smoke:[\s\S]*?(?=\n  [A-Za-z0-9_-]+:|$)/)?.[0];

  assert.ok(iosJob, "Security CI must contain an iOS simulator smoke job");
  assert.match(iosJob, /name: iOS simulator smoke/);
  assert.match(iosJob, /runs-on: macos-15/);
  assert.match(iosJob, /timeout-minutes: 45/);
  assert.match(iosJob, /DEVELOPER_DIR: \/Applications\/Xcode_26\.2\.app\/Contents\/Developer/);
  assert.match(iosJob, /\n\s*NODE_ENV: development/);
  assert.match(iosJob, /npx expo prebuild --platform ios --no-install/);
  assert.match(iosJob, /Verify claimant custody compile contract[\s\S]*?npm run check:claim-custody-isolation/);
  assert.match(iosJob, /Install iOS pods\s*\n\s*working-directory: apps\/mobile\/ios\s*\n\s*run: pod install/);
  assert.match(iosJob, /Compile unsigned iOS simulator release[\s\S]*?NODE_ENV: production[\s\S]*?-configuration Release/);
  assert.match(iosJob, /-sdk iphonesimulator/);
  assert.match(iosJob, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(iosJob, /xcrun simctl install "\$SIMULATOR_UDID" "\$APP_PATH"/);
  assert.match(iosJob, /xcrun simctl launch "\$SIMULATOR_UDID" com\.sanduqkin\.mobile/);
  assert.match(iosJob, /xcrun simctl terminate "\$SIMULATOR_UDID" com\.sanduqkin\.mobile/);
  assert.doesNotMatch(iosJob, /secrets\./);
});

test("protects the manually triggered iOS TestFlight release", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "ios-testflight.yml"),
    "utf8",
  );

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /\n\s+(push|pull_request|schedule):/);
  assert.match(workflow, /release-sbom:[\s\S]*?name: Generate release SBOM/);
  assert.match(workflow, /release-sbom:[\s\S]*?timeout-minutes: 10/);
  assert.match(workflow, /run: npm run sbom:release/);
  assert.match(workflow, /name: sanduqkin-release-sbom-\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /path: artifacts\/sanduqkin\.cdx\.json/);
  assert.match(workflow, /retention-days: 90/);
  assert.match(workflow, /build-and-submit:[\s\S]*?needs: release-sbom/);
  assert.match(workflow, /if: inputs\.confirmation == 'testflight'/);
  assert.match(workflow, /environment: Release/);
  assert.match(workflow, /timeout-minutes: 120/);
  assert.match(workflow, /eas-cli@21\.0\.0 build/);
  assert.match(workflow, /--auto-submit-with-profile production/);
  assert.match(workflow, /--non-interactive/);
  assert.match(workflow, /APP_STORE_CONNECT_PRIVATE_KEY: \$\{\{ secrets\.APP_STORE_CONNECT_PRIVATE_KEY \}\}/);
  assert.match(workflow, /IOS_DISTRIBUTION_P12_BASE64: \$\{\{ secrets\.IOS_DISTRIBUTION_P12_BASE64 \}\}/);
  assert.match(workflow, /IOS_DISTRIBUTION_P12_PASSWORD: \$\{\{ secrets\.IOS_DISTRIBUTION_P12_PASSWORD \}\}/);
  assert.match(workflow, /IOS_PROVISIONING_PROFILE_BASE64: \$\{\{ secrets\.IOS_PROVISIONING_PROFILE_BASE64 \}\}/);
  assert.match(workflow, /base64 --decode > \.eas\/secrets\/ios-distribution\.p12/);
  assert.match(workflow, /writeFileSync\("credentials\.json"/);
  assert.match(workflow, /chmod 600 \.eas\/secrets\/AuthKey_22Q892W9K4\.p8/);
  assert.match(workflow, /if: always\(\)[\s\S]*?rm -rf apps\/mobile\/\.eas\/secrets apps\/mobile\/credentials\.json/);
});

test("runs bounded Android onboarding and returning-user unlock smoke tests after native compilation", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );
  const smokeScript = fs.readFileSync(
    path.resolve(__dirname, "android-emulator-smoke.cjs"),
    "utf8",
  );

  assert.match(workflow, /android-emulator-smoke:\s*\n\s*name: Android emulator smoke/);
  assert.match(workflow, /android-emulator-smoke:[\s\S]*?needs: android-native-compile/);
  assert.match(workflow, /android-emulator-smoke:[\s\S]*?environment: Preview/);
  assert.match(workflow, /android-emulator-smoke:[\s\S]*?if: github\.event_name == 'push'/);
  assert.match(workflow, /android-emulator-smoke:[\s\S]*?timeout-minutes: 25/);
  assert.match(workflow, /name: android-release-apk/);
  assert.match(workflow, /export PATH="\$ANDROID_HOME\/platform-tools:\$PATH"/);
  assert.match(workflow, /timeout 180 adb wait-for-device/);
  assert.match(workflow, /ANDROID_AVD_HOME="\$RUNNER_TEMP\/android-avd"/);
  assert.match(workflow, /emulator" -list-avds \| grep -Fx sanduqkin-ci/);
  assert.match(workflow, /node scripts\/android-recovery-e2e-bootstrap\.cjs/);
  assert.match(workflow, /ANDROID_E2E_TEST_EMAIL: \$\{\{ secrets\.ANDROID_E2E_TEST_EMAIL \}\}/);
  assert.match(workflow, /ANDROID_E2E_TEST_PASSWORD: \$\{\{ secrets\.ANDROID_E2E_TEST_PASSWORD \}\}/);
  assert.match(workflow, /ANDROID_RECOVERY_E2E_EMAIL: \$\{\{ vars\.ANDROID_RECOVERY_E2E_EMAIL \}\}/);
  assert.match(workflow, /ANDROID_RECOVERY_E2E_PASSWORD: \$\{\{ secrets\.ANDROID_E2E_TEST_PASSWORD \}\}/);
  assert.match(workflow, /if: failure\(\)[\s\S]*?adb logcat/);
  assert.match(workflow, /retention-days: 7/);
  for (const marker of [
    "runReturningUserUnlockSmoke",
    "runEncryptedRecordCrudSmoke",
    "runEmergencyCodeHidingSmoke",
    "runRecoveryResetContinuitySmoke",
    "waitForAnyNode",
    "swipeUntilNode",
    'fillField("title field"',
    'waitForNode("Stored sealed on this device")',
    'tapNodeAfterScroll("Delete permanently")',
    'waitForNode("Sanduqkin no longer has the raw code")',
    'fillRecoveryPhrase("Recovery phrase input"',
    'clearAndSignIn(credentials.email, credentials.temporaryPassword)',
    'clearAndSignIn(credentials.email, credentials.password)',
    "ensureOriginalRecoveryPassword(credentials)",
    "finally",
  ]) {
    assert.match(smokeScript, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(
    smokeScript,
    /tapNodeAfterScroll\("Save to vault"\);[\s\S]*?waitForAnyNode\(\[homeHeading, "Bank accounts", title\], 120_000\);[\s\S]*?postSaveDestination\.label === homeHeading[\s\S]*?tapNode\("Records"\);[\s\S]*?tapNodeAfterScroll\("Bank accounts"\);[\s\S]*?postSaveDestination\.label !== title[\s\S]*?waitForNode\(title, 120_000\);/,
  );

  const bootstrapScript = fs.readFileSync(
    path.resolve(__dirname, "android-recovery-e2e-bootstrap.cjs"),
    "utf8",
  );
  for (const marker of [
    "entropyToMnemonic",
    "mnemonicToSeedSync",
    'from("vault_assets").delete()',
    'from("vault_key_material")',
    "ANDROID_RECOVERY_E2E_PHRASE: phrase",
    "ANDROID_RECOVERY_E2E_TEMP_PASSWORD: temporaryPassword",
    "sensitive details were suppressed",
  ]) {
    assert.match(bootstrapScript, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("runs hosted Supabase integration tests serially behind the protected Android job", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  assert.match(workflow, /hosted-supabase-integration:\s*\n\s*name: Hosted Supabase integration/);
  assert.match(workflow, /hosted-supabase-integration:[\s\S]*?environment: Preview/);
  assert.match(workflow, /hosted-supabase-integration:[\s\S]*?needs: android-emulator-smoke/);
  assert.match(workflow, /hosted-supabase-integration:[\s\S]*?if: github\.event_name == 'push'/);
  assert.match(workflow, /hosted-supabase-integration:[\s\S]*?timeout-minutes: 10/);
  assert.match(workflow, /RUN_LIVE_SUPABASE_RETURNING_USER: "1"/);
  assert.match(workflow, /returning-user-live-supabase\.test\.ts/);
  assert.match(workflow, /RUN_LIVE_SUPABASE_ENCRYPTION_SMOKE: "1"/);
  assert.match(workflow, /encrypted-vault-live-supabase-smoke\.test\.ts/);
  assert.match(workflow, /LIVE_SUPABASE_TEST_PASSWORD: \$\{\{ secrets\.ANDROID_E2E_TEST_PASSWORD \}\}/);
});

test("runs production processors in bounded protected-environment jobs", () => {
  const workflowDirectory = path.resolve(__dirname, "..", ".github", "workflows");

  for (const fileName of [
    "account-deletion-processor.yml",
    "audit-retention-processor.yml",
  ]) {
    const workflow = fs.readFileSync(path.join(workflowDirectory, fileName), "utf8");

    assert.match(workflow, /\n\s{4}environment: Production\s*$/m);
    assert.match(workflow, /\n\s{4}timeout-minutes: 10\s*$/m);
    assert.match(workflow, /curl --fail-with-body --retry 2 --retry-all-errors/);
    assert.match(workflow, /--connect-timeout 10 --max-time 60/);
    assert.match(workflow, /report-processor-status:/);
    assert.match(workflow, /if: \$\{\{ always\(\) && github\.ref == 'refs\/heads\/main' \}\}/);
    assert.match(workflow, /report-processor-status:[\s\S]*?permissions:\s*\n\s*contents: read\s*\n\s*issues: write/);
    assert.match(workflow, /PROCESSOR_RESULT: \$\{\{ needs\.[a-z-]+\.result \}\}/);
    assert.match(workflow, /run: node scripts\/report-processor-status\.cjs/);
    assert.match(workflow, /actions\/checkout@[a-f0-9]{40}/);
    assert.match(workflow, /actions\/setup-node@[a-f0-9]{40}/);
  }
});

test("enforces the Phase 1 Definition-of-Done gate in Security CI", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  assert.match(workflow, /- name: Phase 1 Definition-of-Done[\s\S]*?run: npm run check:phase1/);
});

test("enforces workspace linting in Security CI", () => {
  const rootPackage = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "package.json"), "utf8"),
  );
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  assert.equal(rootPackage.scripts.lint, "eslint . --max-warnings=0");
  assert.match(workflow, /- name: Lint[\s\S]*?run: npm run lint/);
});

test("enforces coverage thresholds and publishes summary-only artifacts", () => {
  const mobilePackage = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "apps", "mobile", "package.json"), "utf8"),
  );
  const apiPackage = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "services", "api", "package.json"), "utf8"),
  );
  const mobileConfig = fs.readFileSync(
    path.resolve(__dirname, "..", "apps", "mobile", "vitest.config.ts"),
    "utf8",
  );
  const apiConfigPath = path.resolve(__dirname, "..", "services", "api", "vitest.config.ts");
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  assert.equal(mobilePackage.scripts["test:coverage"], "vitest run --coverage");
  assert.equal(apiPackage.scripts["test:coverage"], "vitest run --coverage");
  assert.match(mobileConfig, /coverage:\s*\{/);
  assert.match(mobileConfig, /thresholds:\s*\{/);
  assert.equal(fs.existsSync(apiConfigPath), true, "API Vitest coverage config must exist");
  assert.match(fs.readFileSync(apiConfigPath, "utf8"), /thresholds:\s*\{/);
  assert.match(workflow, /- name: Coverage thresholds[\s\S]*?npm run test:coverage --workspaces --if-present/);
  assert.match(workflow, /name: coverage-summaries/);
  assert.match(workflow, /apps\/mobile\/coverage\/coverage-summary\.json/);
  assert.match(workflow, /services\/api\/coverage\/coverage-summary\.json/);
  assert.doesNotMatch(workflow, /coverage\/lcov-report|coverage\/index\.html/);
});

test("runs Security CI for pushes to every branch", () => {
  const workflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  assert.match(workflow, /\n  push:\s*\n\s*permissions:/);
});

test("configures CodeQL scanning for JavaScript and TypeScript", () => {
  const workflowPath = path.resolve(
    __dirname,
    "..",
    ".github",
    "workflows",
    "codeql.yml",
  );

  assert.equal(fs.existsSync(workflowPath), true, "CodeQL workflow must exist");

  const workflow = fs.readFileSync(workflowPath, "utf8");

  assert.match(workflow, /\n  pull_request:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /\n  push:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /\n  schedule:\s*\n\s*- cron: "[^"]+"/);
  assert.match(workflow, /\npermissions:\s*\n\s*contents: read\s*\n\s*security-events: write/);
  assert.match(workflow, /language: \["javascript-typescript"\]/);
  assert.match(workflow, /github\/codeql-action\/init@[a-f0-9]{40}/);
  assert.match(workflow, /github\/codeql-action\/analyze@[a-f0-9]{40}/);
});

test("configures an isolated OWASP ZAP baseline scan for the API", () => {
  const workflowPath = path.resolve(
    __dirname,
    "..",
    ".github",
    "workflows",
    "zap.yml",
  );

  assert.equal(fs.existsSync(workflowPath), true, "OWASP ZAP workflow must exist");

  const workflow = fs.readFileSync(workflowPath, "utf8");
  const securityWorkflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );
  const apiPackage = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "services", "api", "package.json"), "utf8"),
  );

  assert.match(workflow, /\n  pull_request:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /\n  push:\s*\n\s*branches: \[main\]/);
  assert.match(workflow, /\n  schedule:\s*\n\s*- cron: "[^"]+"/);
  assert.match(workflow, /\npermissions:\s*\n\s*contents: read/);
  assert.match(workflow, /name: OWASP ZAP baseline/);
  assert.match(workflow, /timeout-minutes: 15/);
  assert.match(workflow, /ghcr\.io\/zaproxy\/zaproxy@sha256:[a-f0-9]{64}/);
  assert.match(workflow, /http:\/\/127\.0\.0\.1:8787\/health/);
  assert.match(workflow, /-c zap-rules\.tsv/);
  assert.match(workflow, /node scripts\/zap-report-check\.cjs zap-reports\/zap-report\.json/);
  assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(securityWorkflow, /node --test[^\n]*scripts\/zap-report-check\.test\.cjs/);
  assert.equal(apiPackage.scripts["start:zap"], "tsx scripts/zap-server.ts");

  const zapRules = fs.readFileSync(path.resolve(__dirname, "..", ".zap", "rules.tsv"), "utf8");
  assert.match(zapRules, /^10049\s+IGNORE\s+/m);
});

test("configures weekly Dependabot updates for npm and GitHub Actions", () => {
  const configPath = path.resolve(__dirname, "..", ".github", "dependabot.yml");

  assert.equal(fs.existsSync(configPath), true, "Dependabot configuration must exist");

  const config = fs.readFileSync(configPath, "utf8");
  const securityWorkflow = fs.readFileSync(
    path.resolve(__dirname, "..", ".github", "workflows", "security-ci.yml"),
    "utf8",
  );

  assert.match(config, /package-ecosystem: "npm"[\s\S]*?directory: "\/"[\s\S]*?interval: "weekly"/);
  assert.match(
    config,
    /package-ecosystem: "github-actions"[\s\S]*?directory: "\/"[\s\S]*?interval: "weekly"/,
  );
  assert.match(config, /reviewers:\s*\n\s*- "shahbaz242630"/);
  assert.match(securityWorkflow, /npm run check:production-dependencies/);
});

test("rejects mutable action tags and accepts full commit SHAs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "github-actions-security-"));
  const workflowDir = path.join(tmp, ".github", "workflows");

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "pins.yml"),
    [
      "name: pins",
      "on:",
      "  push:",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout@v4",
      "      - uses: actions/setup-node@0123456789abcdef0123456789abcdef01234567 # v4",
      "",
    ].join("\n"),
  );

  const result = runGitHubActionsSecurityCheck({ cwd: tmp });

  assert.deepEqual(result.violations.map((violation) => violation.rule), [
    "github-actions-pinned-actions",
  ]);
});

test("checks action allowlisting when a SHA pin has a version comment", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "github-actions-security-"));
  const workflowDir = path.join(tmp, ".github", "workflows");

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "comment-bypass.yml"),
    [
      "name: comment bypass",
      "on:",
      "  push:",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: untrusted/action@0123456789abcdef0123456789abcdef01234567 # v1",
      "",
    ].join("\n"),
  );

  const result = runGitHubActionsSecurityCheck({ cwd: tmp });

  assert.deepEqual(result.violations.map((violation) => violation.rule), [
    "github-actions-allowed-actions",
  ]);
});

test("flags dangerous workflow triggers, permissions, actions, and PR secrets", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "github-actions-security-"));
  const workflowDir = path.join(tmp, ".github", "workflows");

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "unsafe.yml"),
    [
      "name: unsafe",
      "on:",
      "  pull_request:",
      "  pull_request_target:",
      "permissions: write-all",
      "jobs:",
      "  test:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - uses: actions/checkout",
      "      - uses: bad/action@v1",
      "      - run: echo ${{ secrets.API_KEY }}",
      "",
    ].join("\n"),
  );

  const result = runGitHubActionsSecurityCheck({ cwd: tmp });

  assert.equal(result.ok, false);
  assert.deepEqual(
    result.violations.map((violation) => violation.rule),
    [
      "github-actions-no-pull-request-target",
      "github-actions-no-write-all-permissions",
      "github-actions-minimal-permissions",
      "github-actions-pinned-actions",
      "github-actions-pinned-actions",
      "github-actions-allowed-actions",
      "github-actions-no-secrets-on-pr",
      "github-actions-secrets-require-environment",
    ],
  );
});

test("allows scheduled workflows to use secrets with minimal permissions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "github-actions-security-"));
  const workflowDir = path.join(tmp, ".github", "workflows");

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "scheduled.yml"),
    [
      "name: scheduled",
      "on:",
      "  workflow_dispatch:",
      "  schedule:",
      "    - cron: '17 2 * * *'",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  call:",
      "    environment: Production",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo ${{ secrets.PROCESSOR_TOKEN }}",
      "",
    ].join("\n"),
  );

  const result = runGitHubActionsSecurityCheck({ cwd: tmp });

  assert.deepEqual(result, {
    ok: true,
    violations: [],
  });
});

test("requires secret-bearing jobs to use an approved environment", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "github-actions-security-"));
  const workflowDir = path.join(tmp, ".github", "workflows");

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "unprotected-secret.yml"),
    [
      "name: unprotected secret",
      "on:",
      "  workflow_dispatch:",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  call:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: test -n '${{ secrets.PROCESSOR_TOKEN }}'",
      "",
    ].join("\n"),
  );

  const result = runGitHubActionsSecurityCheck({ cwd: tmp });

  assert.deepEqual(result.violations.map((violation) => violation.rule), [
    "github-actions-secrets-require-environment",
  ]);
});

test("allows pull-request workflows to isolate secrets in push-only jobs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "github-actions-security-"));
  const workflowDir = path.join(tmp, ".github", "workflows");

  fs.mkdirSync(workflowDir, { recursive: true });
  fs.writeFileSync(
    path.join(workflowDir, "push-secret.yml"),
    [
      "name: push secret",
      "on:",
      "  pull_request:",
      "  push:",
      "permissions:",
      "  contents: read",
      "jobs:",
      "  public-check:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: echo public",
      "  protected-check:",
      "    if: github.event_name == 'push'",
      "    environment: Preview",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      - run: test -n '${{ secrets.QA_PASSWORD }}'",
      "",
    ].join("\n"),
  );

  const result = runGitHubActionsSecurityCheck({ cwd: tmp });

  assert.deepEqual(result, { ok: true, violations: [] });
});
