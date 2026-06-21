const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_SCAN_ROOTS = [
  path.join("apps", "mobile", "app"),
  path.join("apps", "mobile", "assets"),
  path.join("apps", "mobile", "src"),
  path.join("apps", "mobile", "dist"),
  path.join("apps", "mobile", "web-build"),
  path.join(".security", "mobile-export"),
];

const EXCLUDED_DIRS = new Set([
  ".expo",
  ".git",
  "coverage",
  "node_modules",
]);

const EXCLUDED_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/i,
  /\.spec\.[cm]?[jt]sx?$/i,
  /(^|[/\\])__tests__([/\\]|$)/i,
];

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".map",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
]);

const SECRET_PATTERNS = [
  {
    name: "server-only-env-name",
    pattern:
      /\b(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE_KEY|SERVICE_ROLE|RESEND_API_KEY|REVENUECAT_WEBHOOK_SECRET|ACCOUNT_DELETION_PROCESSOR_TOKEN|AUDIT_RETENTION_PROCESSOR_TOKEN|PROCESSOR_TOKEN|WEBHOOK_SECRET)\b/,
  },
  {
    name: "private-key-material",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/,
  },
  {
    name: "supabase-service-role-jwt",
    pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*InJvbGUiOiJzZXJ2aWNlX3JvbGUi[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/,
  },
  {
    name: "aws-access-key-id",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
];

const ALLOWED_REFERENCES = new Map([
  [
    normalizePath(path.join("apps", "mobile", "src", "shared", "config", "supabase-env.ts")),
    new Set(["server-only-env-name"]),
  ],
]);

function runMobileSecretScan(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const roots = options.roots ?? DEFAULT_SCAN_ROOTS;
  const findings = [];

  for (const root of roots) {
    const absoluteRoot = path.join(cwd, root);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }

    for (const filePath of collectFiles(absoluteRoot)) {
      if (shouldSkipFile(filePath)) {
        continue;
      }

      const relativePath = normalizePath(path.relative(cwd, filePath));
      const contents = fs.readFileSync(filePath, "utf8");

      for (const secretPattern of SECRET_PATTERNS) {
        if (!secretPattern.pattern.test(contents)) {
          continue;
        }
        if (ALLOWED_REFERENCES.get(relativePath)?.has(secretPattern.name)) {
          continue;
        }

        findings.push({
          path: relativePath,
          rule: secretPattern.name,
        });
      }
    }
  }

  return {
    findings,
    ok: findings.length === 0,
  };
}

function collectFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        files.push(...collectFiles(absolutePath));
      }
      continue;
    }

    if (entry.isFile() && isTextFile(absolutePath)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function shouldSkipFile(filePath) {
  return EXCLUDED_FILE_PATTERNS.some((pattern) => pattern.test(filePath));
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function printResult(result) {
  if (result.ok) {
    console.log("Mobile secret scan passed.");
    return;
  }

  console.error("Mobile secret scan failed:");
  for (const finding of result.findings) {
    console.error(`- ${finding.rule}: ${finding.path}`);
  }
}

if (require.main === module) {
  const result = runMobileSecretScan();
  printResult(result);
  process.exit(result.ok ? 0 : 1);
}

module.exports = {
  runMobileSecretScan,
};
