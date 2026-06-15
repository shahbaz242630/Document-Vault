const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_OPTIONS = {
  configPath: path.join("supabase", "config.toml"),
  migrationDir: path.join("supabase", "migrations"),
  mobileRoots: [path.join("apps", "mobile", "app"), path.join("apps", "mobile", "src")],
};

function runSecurityCheck(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const checkOptions = { ...DEFAULT_OPTIONS, ...options };
  const violations = [
    ...checkSupabaseAuthConfig(cwd, checkOptions.configPath),
    ...checkSupabaseMigrations(cwd, checkOptions.migrationDir),
    ...checkMobileSecrets(cwd, checkOptions.mobileRoots),
  ];

  return {
    ok: violations.length === 0,
    violations,
  };
}

function checkSupabaseAuthConfig(cwd, configPath) {
  const absolutePath = path.join(cwd, configPath);
  const contents = readFileIfExists(absolutePath);
  const violations = [];

  if (contents === null) {
    return [
      {
        message: "Supabase config file is missing.",
        path: normalizePath(configPath),
        rule: "supabase-config-present",
      },
    ];
  }

  const minimumPasswordLength = readTomlNumber(contents, "minimum_password_length");
  if (minimumPasswordLength === null || minimumPasswordLength < 12) {
    violations.push({
      message: "Supabase auth password minimum must be at least 12.",
      path: normalizePath(configPath),
      rule: "supabase-password-minimum",
    });
  }

  const securePasswordChange = readTomlBoolean(contents, "secure_password_change");
  if (securePasswordChange !== true) {
    violations.push({
      message: "Supabase auth secure password change must be enabled.",
      path: normalizePath(configPath),
      rule: "supabase-secure-password-change",
    });
  }

  return violations;
}

function checkSupabaseMigrations(cwd, migrationDir) {
  const absoluteDir = path.join(cwd, migrationDir);
  const files = fs
    .readdirSync(absoluteDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();
  const sql = files
    .map((fileName) => fs.readFileSync(path.join(absoluteDir, fileName), "utf8"))
    .join("\n");
  const publicTables = findPublicTables(sql);
  const violations = [];

  for (const table of publicTables) {
    if (!hasRlsEnabled(sql, table)) {
      violations.push({
        message: `Public table ${table} is created without enabling RLS.`,
        path: normalizePath(migrationDir),
        rule: "supabase-public-table-rls",
        table,
      });
    }

    if (!hasAuthenticatedRevokeAll(sql, table)) {
      violations.push({
        message: `Public table ${table} must explicitly revoke broad authenticated privileges before narrow grants.`,
        path: normalizePath(migrationDir),
        rule: "supabase-authenticated-revoke-all",
        table,
      });
    }
  }

  const anonGrantMatches = [...sql.matchAll(/\bgrant\s+[^;]*?\bon\s+table\s+public\.([a-z0-9_]+)\s+to\s+anon\b/gi)];
  for (const match of anonGrantMatches) {
    violations.push({
      message: `Public table ${match[1]} grants privileges to anon.`,
      path: normalizePath(migrationDir),
      rule: "supabase-no-anon-table-grants",
      table: match[1],
    });
  }

  const exposedSecurityDefiners = [
    ...sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)[\s\S]*?\bsecurity\s+definer\b/gi),
  ];
  for (const match of exposedSecurityDefiners) {
    violations.push({
      message: `Security definer function public.${match[1]} is in an exposed schema.`,
      path: normalizePath(migrationDir),
      rule: "supabase-no-public-security-definer",
    });
  }

  const exposedViews = [...sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?view\s+public\.([a-z0-9_]+)/gi)];
  for (const match of exposedViews) {
    const viewDefinition = getStatementForMatch(sql, match.index ?? 0);
    if (!/\bsecurity_invoker\s*=\s*true\b/i.test(viewDefinition)) {
      violations.push({
        message: `Public view ${match[1]} must use security_invoker=true or stay unexposed.`,
        path: normalizePath(migrationDir),
        rule: "supabase-public-view-security-invoker",
      });
    }
  }

  return violations;
}

function checkMobileSecrets(cwd, roots) {
  const violations = [];
  const secretPattern = /\b(?:SUPABASE_SERVICE_ROLE_KEY|SERVICE_ROLE|SECRET_KEY|RESEND_API_KEY|WEBHOOK_SECRET|PROCESSOR_TOKEN)\b/;

  for (const root of roots) {
    const absoluteRoot = path.join(cwd, root);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }

    for (const filePath of collectFiles(absoluteRoot)) {
      if (!/\.[cm]?[jt]sx?$/.test(filePath)) {
        continue;
      }
      const relativePath = normalizePath(path.relative(cwd, filePath));
      if (relativePath === "apps/mobile/src/shared/config/supabase-env.ts") {
        continue;
      }
      const contents = fs.readFileSync(filePath, "utf8");
      const match = contents.match(secretPattern);
      if (match) {
        violations.push({
          message: `Mobile source references server-only secret marker ${match[0]}.`,
          path: relativePath,
          rule: "mobile-no-server-secret-markers",
        });
      }
    }
  }

  return violations;
}

function findPublicTables(sql) {
  return [
    ...new Set(
      [...sql.matchAll(/\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi)].map(
        (match) => match[1],
      ),
    ),
  ].sort();
}

function hasRlsEnabled(sql, table) {
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `\\balter\\s+table\\s+public\\.${escapedTable}\\s+enable\\s+row\\s+level\\s+security\\b`,
    "i",
  ).test(sql);
}

function hasAuthenticatedRevokeAll(sql, table) {
  const escapedTable = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `\\brevoke\\s+all\\s+on\\s+table\\s+public\\.${escapedTable}\\s+from\\s+authenticated\\b`,
    "i",
  ).test(sql);
}

function collectFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (![".expo", "coverage", "dist", "node_modules"].includes(entry.name)) {
        files.push(...collectFiles(absolutePath));
      }
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

function getStatementForMatch(sql, index) {
  const endIndex = sql.indexOf(";", index);
  return sql.slice(index, endIndex === -1 ? undefined : endIndex + 1);
}

function readTomlNumber(contents, key) {
  const match = contents.match(new RegExp(`^\\s*${key}\\s*=\\s*(\\d+)\\s*$`, "m"));
  return match ? Number(match[1]) : null;
}

function readTomlBoolean(contents, key) {
  const match = contents.match(new RegExp(`^\\s*${key}\\s*=\\s*(true|false)\\s*$`, "m"));
  return match ? match[1] === "true" : null;
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function printResult(result) {
  if (result.ok) {
    console.log("Security guard passed.");
    return;
  }

  console.error("Security guard failed:");
  for (const violation of result.violations) {
    const table = violation.table ? ` (${violation.table})` : "";
    console.error(`- ${violation.rule}: ${violation.path}${table} ${violation.message}`);
  }
}

if (require.main === module) {
  const result = runSecurityCheck();
  printResult(result);
  process.exit(result.ok ? 0 : 1);
}

module.exports = {
  runSecurityCheck,
};
