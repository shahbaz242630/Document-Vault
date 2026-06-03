const fs = require("node:fs");
const path = require("node:path");
const ts = loadTypeScript();

const SOURCE_EXTENSIONS = new Set([".cjs", ".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const DEFAULT_ROOTS = ["apps", "services", "packages", "scripts"];
const DEFAULT_OPTIONS = {
  fileLineLimit: 500,
  functionLineLimit: 100,
};

function runPhase1DodCheck(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const sourceFiles = collectSourceFiles(cwd, options.roots ?? DEFAULT_ROOTS);
  const checkOptions = { ...DEFAULT_OPTIONS, ...options };
  const violations = [
    ...findProductionTodos(cwd, sourceFiles),
    ...findOversizedFiles(cwd, sourceFiles, checkOptions.fileLineLimit),
    ...findLongFunctions(cwd, sourceFiles, checkOptions.functionLineLimit),
  ];

  return {
    ok: violations.length === 0,
    violations,
  };
}

function loadTypeScript() {
  const workspaceRoot = path.join(__dirname, "..");
  const candidatePaths = [
    workspaceRoot,
    path.join(workspaceRoot, "apps", "mobile"),
    path.join(workspaceRoot, "services", "api"),
    path.join(workspaceRoot, "packages", "shared-types"),
    path.join(workspaceRoot, "packages", "shared-validation"),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      return require(require.resolve("typescript", { paths: [candidatePath] }));
    } catch {
      // Try the next workspace package.
    }
  }

  throw new Error("Unable to resolve TypeScript from the workspace packages.");
}

function collectSourceFiles(cwd, roots) {
  const files = [];

  for (const root of roots) {
    const absoluteRoot = path.join(cwd, root);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }
    walk(absoluteRoot, files);
  }

  return files
    .filter((filePath) => SOURCE_EXTENSIONS.has(path.extname(filePath)))
    .filter((filePath) => !isIgnoredSourceFile(filePath))
    .sort((left, right) => toRelativePath(cwd, left).localeCompare(toRelativePath(cwd, right)));
}

function walk(directory, files) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!isIgnoredDirectory(entry.name)) {
        walk(absolutePath, files);
      }
      continue;
    }
    if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
}

function findProductionTodos(cwd, sourceFiles) {
  const violations = [];

  for (const filePath of sourceFiles) {
    if (isTestFile(filePath)) {
      continue;
    }
    const lines = readLines(filePath);
    lines.forEach((line, index) => {
      if (getProductionMarkerPattern().test(line)) {
        violations.push({
          line: index + 1,
          message: "Production source contains a blocked launch marker.",
          path: toRelativePath(cwd, filePath),
          rule: "production-todo",
        });
      }
    });
  }

  return violations;
}

function getProductionMarkerPattern() {
  const todo = ["TO", "DO"].join("");
  const fixme = ["FIX", "ME"].join("");
  const xxx = ["X", "XX"].join("");
  return new RegExp(`\\b(${todo}|${fixme}|${xxx})\\b`);
}

function findOversizedFiles(cwd, sourceFiles, fileLineLimit) {
  return sourceFiles
    .filter((filePath) => !isTestFile(filePath))
    .map((filePath) => ({
      lineCount: readLines(filePath).length,
      path: toRelativePath(cwd, filePath),
    }))
    .filter((file) => file.lineCount > fileLineLimit)
    .map((file) => ({
      line: file.lineCount,
      message: `File has ${file.lineCount} lines; limit is ${fileLineLimit}.`,
      path: file.path,
      rule: "file-line-limit",
    }));
}

function findLongFunctions(cwd, sourceFiles, functionLineLimit) {
  const violations = [];

  for (const filePath of sourceFiles) {
    if (isTestFile(filePath)) {
      continue;
    }
    const contents = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
      filePath,
      contents,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(filePath),
    );

    visitFunctionBodies(sourceFile, sourceFile, (node) => {
      const start = sourceFile.getLineAndCharacterOfPosition(node.body.getStart(sourceFile)).line + 1;
      const end = sourceFile.getLineAndCharacterOfPosition(node.body.getEnd()).line + 1;
      const lineCount = end - start + 1;
      if (lineCount > functionLineLimit) {
        violations.push({
          line: start,
          message: `Function has ${lineCount} body lines; limit is ${functionLineLimit}.`,
          path: toRelativePath(cwd, filePath),
          rule: "function-line-limit",
        });
      }
    });
  }

  return violations;
}

function visitFunctionBodies(sourceFile, node, onFunctionWithBody) {
  if (isFunctionLikeWithBody(node)) {
    onFunctionWithBody(node);
  }
  ts.forEachChild(node, (child) => visitFunctionBodies(sourceFile, child, onFunctionWithBody));
}

function isFunctionLikeWithBody(node) {
  return (
    node.body &&
    (ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node) ||
      ts.isConstructorDeclaration(node) ||
      ts.isGetAccessorDeclaration(node) ||
      ts.isSetAccessorDeclaration(node))
  );
}

function getScriptKind(filePath) {
  switch (path.extname(filePath)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
    case ".cjs":
    case ".mjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function readLines(filePath) {
  const contents = fs.readFileSync(filePath, "utf8");
  if (contents.length === 0) {
    return [];
  }
  return contents.replace(/\r\n/g, "\n").split("\n");
}

function isIgnoredDirectory(directoryName) {
  return [".expo", ".git", ".next", ".vercel", "build", "coverage", "dist", "node_modules"].includes(
    directoryName,
  );
}

function isIgnoredSourceFile(filePath) {
  return filePath.endsWith(".d.ts");
}

function isTestFile(filePath) {
  return /(?:^|[\\/])__tests__[\\/]/.test(filePath) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(filePath);
}

function toRelativePath(cwd, filePath) {
  return path.relative(cwd, filePath).replace(/\\/g, "/");
}

function printResult(result) {
  if (result.ok) {
    console.log("Phase 1 DoD guard passed.");
    return;
  }

  console.error("Phase 1 DoD guard failed:");
  for (const violation of result.violations) {
    console.error(`- ${violation.rule}: ${violation.path}:${violation.line} ${violation.message}`);
  }
}

if (require.main === module) {
  const result = runPhase1DodCheck();
  printResult(result);
  process.exit(result.ok ? 0 : 1);
}

module.exports = {
  runPhase1DodCheck,
};
