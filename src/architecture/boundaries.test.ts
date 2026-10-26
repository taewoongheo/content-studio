import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const config = ts.readConfigFile(path.join(root, "tsconfig.json"), ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
const relative = (file: string) => path.relative(root, file).replaceAll(path.sep, "/");
const sources = ts.sys.readDirectory(path.join(root, "src"), [".ts", ".tsx"])
  .filter(file => !file.endsWith(".test.ts"));

/** Resolve actual imports, including aliases, re-exports and literal dynamic imports. */
function imports(file: string) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const targets: string[] = [];
  function visit(node: ts.Node) {
    let specifier: ts.Node | undefined;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
    else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require"))) specifier = node.arguments[0];
    if (specifier && ts.isStringLiteral(specifier)) {
      const target = ts.resolveModuleName(specifier.text, file, options, ts.sys).resolvedModule?.resolvedFileName;
      if (target && !target.includes("node_modules")) targets.push(relative(target));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return targets;
}

const graph = new Map(sources.map(file => [relative(file), imports(file)]));

test("공통 라이브러리는 기능 구현을 소유하지 않고 DB 초기화는 스키마만 참조한다", () => {
  const allowedSchemas = new Set([
    "src/domains/content-production/server/persistence/schema.ts",
    "src/domains/slideshow/server/persistence/projects/schema.ts",
    "src/domains/video/server/persistence/schema.ts",
  ]);
  const violations: string[] = [];
  for (const [from, targets] of graph) {
    if (!from.startsWith("src/lib/") || from.startsWith("src/lib/mcp/")) continue;
    for (const to of targets) {
      if (!/^src\/(domains|screens|app)\//.test(to)) continue;
      if (from === "src/lib/local-db/database.ts" && allowedSchemas.has(to)) continue;
      violations.push(`${from} -> ${to}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("도메인은 화면·MCP·라우트에 의존하지 않고 편집기 간 조합은 workspace가 담당한다", () => {
  const violations: string[] = [];
  for (const [from, targets] of graph) {
    if (!from.startsWith("src/domains/")) continue;
    for (const to of targets) {
      if (/^src\/(screens|app|lib\/mcp)\//.test(to) ||
        (from.startsWith("src/domains/slideshow/") && to.startsWith("src/domains/video/")) ||
        (from.startsWith("src/domains/video/") && to.startsWith("src/domains/slideshow/")))
        violations.push(`${from} -> ${to}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("클라이언트 진입점은 전이적으로도 서버 구현과 Node 전용 모듈을 가져오지 않는다", () => {
  const violations = new Set<string>();
  const visited = new Set<string>();
  function visit(file: string) {
    if (visited.has(file)) return;
    visited.add(file);
    // TypeScript's import graph above intentionally includes type imports for domain rules.
    // Client runtime checks use transpilation to exclude erased type-only dependencies.
    const source = readFileSync(path.join(root, file), "utf8");
    const emitted = ts.transpileModule(source, { compilerOptions: { ...options, jsx: ts.JsxEmit.Preserve } }).outputText;
    const parsed = ts.createSourceFile(file, emitted, ts.ScriptTarget.Latest, true);
    function inspect(node: ts.Node) {
      let specifier: ts.Node | undefined;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier;
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) specifier = node.arguments[0];
      if (specifier && ts.isStringLiteral(specifier)) {
        const name = specifier.text;
        if (name.startsWith("node:") || ["better-sqlite3", "playwright", "sharp"].includes(name)) violations.add(`${file} -> ${name}`);
        const target = ts.resolveModuleName(name, path.join(root, file), options, ts.sys).resolvedModule?.resolvedFileName;
        if (target && !target.includes("node_modules")) {
          const to = relative(target);
          if (/^src\/(lib\/(local-db|mcp)|domains\/[^/]+\/server)\//.test(to)) violations.add(`${file} -> ${to}`);
          if (graph.has(to)) visit(to);
        }
      }
      ts.forEachChild(node, inspect);
    }
    inspect(parsed);
  }
  for (const file of graph.keys()) {
    if (/^["']use client["'];/.test(readFileSync(path.join(root, file), "utf8"))) visit(file);
  }
  assert.deepEqual([...violations], []);
});
