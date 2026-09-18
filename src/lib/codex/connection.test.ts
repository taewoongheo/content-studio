import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CodexConnectionManager } from "./connection";

async function withFakeCodex(
  account: unknown,
  run: (manager: CodexConnectionManager) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), "content-studio-codex-"));
  const executable = join(directory, "codex");
  const original = process.env.CODEX_BIN;
  await writeFile(
    executable,
    `#!/usr/bin/env node
const readline = require('node:readline');
let initialized = false;
readline.createInterface({input: process.stdin}).on('line', line => {
  const message = JSON.parse(line);
  if (message.method === 'initialized') { initialized = true; return; }
  if (message.method === 'initialize') {
    console.log(JSON.stringify({id:message.id,result:{}}));
  } else if (message.method === 'account/read' && initialized) {
    console.log(JSON.stringify({id:message.id,result:{account:${JSON.stringify(account)}}}));
  } else {
    console.log(JSON.stringify({id:message.id,error:{message:'Invalid handshake'}}));
  }
}).on('close', () => process.exit());
`,
    { mode: 0o755 },
  );
  process.env.CODEX_BIN = executable;
  const manager = new CodexConnectionManager();
  try {
    await run(manager);
  } finally {
    await manager.disconnect();
    if (original === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = original;
    await rm(directory, { recursive: true, force: true });
  }
}

test("connect shares initialization and disconnect allows a new connection", async () => {
  await withFakeCodex({ type: "chatgpt" }, async (manager) => {
    const first = manager.connect();
    assert.equal(manager.connect(), first);
    assert.equal((await first).status, "connected");
    assert.equal((await manager.disconnect()).status, "disconnected");
    assert.equal((await manager.connect()).status, "connected");
  });
});

test("missing login and API key accounts are never shown as connected", async () => {
  for (const account of [null, { type: "apiKey" }]) {
    await withFakeCodex(account, async (manager) => {
      assert.equal((await manager.connect()).status, "login-required");
    });
  }
});

test("disconnect during initialization leaves the connection stopped", async () => {
  await withFakeCodex({ type: "chatgpt" }, async (manager) => {
    const connecting = manager.connect();
    await manager.disconnect();
    await connecting;
    assert.equal(manager.snapshot().status, "disconnected");
  });
});

test("missing executable reports an actionable error and can be disconnected", async () => {
  const original = process.env.CODEX_BIN;
  process.env.CODEX_BIN = "/nonexistent/content-studio-codex";
  const manager = new CodexConnectionManager();
  try {
    const state = await manager.connect();
    assert.equal(state.status, "error");
    assert.match(state.message, /CLI를 찾을 수 없습니다/);
    assert.equal((await manager.disconnect()).status, "disconnected");
  } finally {
    await manager.disconnect();
    if (original === undefined) delete process.env.CODEX_BIN;
    else process.env.CODEX_BIN = original;
  }
});
