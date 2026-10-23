import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCodex } from "./process";

test("제작 CLI는 실행별 웹 검색과 작업 전용 MCP를 사용하고 읽기 전용 권한을 유지한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "production-cli-test-"));
  const executable = join(directory, "codex.cjs"), argsPath = join(directory, "args.json");
  const previous = process.env.CONTENT_STUDIO_CODEX_BIN;
  try {
    await writeFile(executable, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "mcp") {
  console.log(JSON.stringify([{name:"other",enabled:true,transport:{url:"http://127.0.0.1:9999/mcp"}}]));
} else {
  fs.writeFileSync(${JSON.stringify(argsPath)},JSON.stringify(args));
  fs.writeFileSync(args[args.indexOf("--output-last-message")+1],JSON.stringify({ok:true}));
}
`, { mode: 0o700 });
    process.env.CONTENT_STUDIO_CODEX_BIN = executable;
    const result = await runCodex({ prompt: "test", schema: {}, origin: "http://127.0.0.1:3000",
      taskId: "task", token: "test-token", signal: new AbortController().signal, onActivity() {} });
    assert.deepEqual(result, { ok: true });
    const args: string[] = JSON.parse(await readFile(argsPath, "utf8"));
    assert.equal(args[args.indexOf("--sandbox") + 1], "read-only");
    const overrides = args.flatMap((value, index) => value === "-c" ? [args[index + 1]] : []);
    assert.ok(overrides.includes('web_search="live"'));
    assert.ok(overrides.includes("mcp_servers.other.enabled=false"));
    assert.ok(overrides.includes("mcp_servers.production.enabled=true"));
    assert.ok(overrides.includes('mcp_servers.production.url="http://127.0.0.1:3000/api/content-production/agent/task"'));
    assert.equal(args.includes("test-token"), false);
  } finally {
    if (previous === undefined) delete process.env.CONTENT_STUDIO_CODEX_BIN;
    else process.env.CONTENT_STUDIO_CODEX_BIN = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
