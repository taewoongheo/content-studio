import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CodexConnectionManager } from "./connection";
import { connectionEvents } from "./connection-events";

async function withFakeCodex(
  account: unknown,
  run: (manager: CodexConnectionManager) => Promise<void>,
  options?: ConstructorParameters<typeof CodexConnectionManager>[0],
) {
  const directory = await mkdtemp(join(tmpdir(), "content-studio-codex-"));
  const executable = join(directory, "codex");
  const original = process.env.CODEX_BIN;
  await writeFile(
    executable,
    `#!/usr/bin/env node
const readline = require('node:readline');
let initialized = false;
let nextThread = 0;
let nextTurn = 0;
function send(message) { console.log(JSON.stringify(message)); }
readline.createInterface({input: process.stdin}).on('line', line => {
  const message = JSON.parse(line);
  if (message.method === 'initialized') { initialized = true; return; }
  if (message.method === 'initialize') {
    send({id:message.id,result:{}});
  } else if (message.method === 'account/read' && initialized) {
    send({id:message.id,result:{account:${JSON.stringify(account)}}});
  } else if (message.method === 'model/list' && initialized) {
    send({id:message.id,result:{data:[
      {id:'sol',model:'gpt-6-sol',displayName:'GPT-6 Sol',description:'workhorse',hidden:false,isDefault:true,inputModalities:['text','image']},
      {id:'luna',model:'gpt-6-luna',displayName:'GPT-6 Luna',description:'efficient',hidden:false,isDefault:false,inputModalities:['text','image']},
      {id:'hidden',model:'hidden-model',displayName:'Hidden',description:'',hidden:true,isDefault:false,inputModalities:['text','image']}
    ],nextCursor:null}});
  } else if (message.method === 'thread/start' && initialized) {
    const prefix = message.params.model ? message.params.model + '-' : '';
    const threadId = prefix + 'thread-' + ++nextThread;
    send({id:message.id,result:{thread:{id:threadId}}});
    send({method:'thread/started',params:{thread:{id:threadId}}});
  } else if (message.method === 'turn/start' && initialized) {
    const turnId = 'turn-' + ++nextTurn;
    const threadId = message.params.threadId;
    const text = message.params.input.find(item => item.type === 'text')?.text || '';
    send({id:message.id,result:{turn:{id:turnId,status:'inProgress',items:[],error:null}}});
    if (text === 'timeout') return;
    setTimeout(() => {
      if (text !== 'fail' && text !== 'interrupt') {
        const output = text === 'invalid-json'
          ? 'not json'
          : JSON.stringify({answer:message.params.outputSchema.properties.answer.type});
        send({method:'item/completed',params:{
          threadId,
          turnId,
          completedAtMs:Date.now(),
          item:{id:'message-' + turnId,type:'agentMessage',text:output,phase:'final_answer',memoryCitation:null}
        }});
      }
      const status = text === 'fail' ? 'failed' : text === 'interrupt' ? 'interrupted' : 'completed';
      send({method:'turn/completed',params:{
        threadId,
        turn:{
          id:turnId,
          status,
          items:[],
          itemsView:'full',
          error:status === 'failed' ? {message:'boom',codexErrorInfo:null,additionalDetails:null} : null,
          startedAt:null,
          completedAt:null,
          durationMs:null
        }
      }});
    }, 0);
  } else {
    send({id:message.id,error:{message:'Invalid handshake'}});
  }
}).on('close', () => process.exit());
`,
    { mode: 0o755 },
  );
  process.env.CODEX_BIN = executable;
  const manager = new CodexConnectionManager(options);
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

test("event stream sends initial state and subsequent changes without polling", async () => {
  await withFakeCodex({ type: "chatgpt" }, async (manager) => {
    const response = connectionEvents(manager, new AbortController().signal);
    const reader = response.body!.getReader();
    const readStatus = async () => {
      const { value } = await reader.read();
      return JSON.parse(new TextDecoder().decode(value).slice(6)).status;
    };
    assert.equal(await readStatus(), "disconnected");
    const connecting = manager.connect();
    assert.equal(await readStatus(), "connecting");
    await connecting;
    assert.equal(await readStatus(), "connected");
    await manager.disconnect();
    assert.equal(await readStatus(), "disconnected");
    await reader.cancel();
    // A closed stream must not receive later notifications or stop Codex.
    assert.equal((await manager.connect()).status, "connected");
  });
});

test("aborting the browser stream removes its subscription", async () => {
  await withFakeCodex({ type: "chatgpt" }, async (manager) => {
    const abort = new AbortController();
    const reader = connectionEvents(manager, abort.signal).body!.getReader();
    await reader.read();
    abort.abort();
    assert.equal((await reader.read()).done, true);
    assert.equal((await manager.connect()).status, "connected");
  });
});

test("one app-server process starts a separate thread for each job", async () => {
  await withFakeCodex({ type: "chatgpt" }, async (manager) => {
    await manager.connect();
    const first = await manager.startThread({ cwd: "/tmp/project-a" });
    const second = await manager.startThread({ cwd: "/tmp/project-b" });
    assert.equal(first.threadId, "thread-1");
    assert.equal(second.threadId, "thread-2");
  });
});

test("lists available models and forwards the selected model to a thread", async () => {
  await withFakeCodex({ type: "chatgpt" }, async (manager) => {
    await manager.connect();
    const models = await manager.listModels();
    assert.deepEqual(
      models.map((model) => model.model),
      ["gpt-6-sol", "gpt-6-luna"],
    );
    assert.equal(
      (
        await manager.startThread({
          cwd: "/tmp/project",
          model: "gpt-6-luna",
        })
      ).threadId,
      "gpt-6-luna-thread-1",
    );
  });
});

test("routes notifications by thread and turn identifiers", async () => {
  await withFakeCodex({ type: "chatgpt" }, async (manager) => {
    const events: Array<{ method: string; threadId?: string; turnId?: string }> =
      [];
    const unsubscribe = manager.subscribeNotifications((event) => {
      events.push({
        method: event.method,
        threadId: event.threadId,
        turnId: event.turnId,
      });
    });
    await manager.connect();
    const { threadId } = await manager.startThread();
    await manager.runStructuredTurn({
      threadId,
      input: [{ type: "text", text: "success" }],
      outputSchema: {
        type: "object",
        properties: { answer: { type: "string" } },
        required: ["answer"],
        additionalProperties: false,
      },
    });
    unsubscribe();
    assert.ok(
      events.some(
        (event) =>
          event.method === "thread/started" && event.threadId === threadId,
      ),
    );
    assert.ok(
      events.some(
        (event) =>
          event.method === "turn/completed" &&
          event.threadId === threadId &&
          event.turnId === "turn-1",
      ),
    );
  });
});

test("runs a structured turn and parses the final agent message", async () => {
  await withFakeCodex({ type: "chatgpt" }, async (manager) => {
    await manager.connect();
    const { threadId } = await manager.startThread();
    const result = await manager.runStructuredTurn({
      threadId,
      input: [{ type: "text", text: "success" }],
      outputSchema: {
        type: "object",
        properties: { answer: { type: "string" } },
        required: ["answer"],
        additionalProperties: false,
      },
    });
    assert.deepEqual(result, {
      status: "completed",
      threadId,
      turnId: "turn-1",
      output: { answer: "string" },
    });
  });
});

test("returns explicit failures for failed, interrupted, malformed, and timed-out turns", async () => {
  await withFakeCodex(
    { type: "chatgpt" },
    async (manager) => {
      await manager.connect();
      const { threadId } = await manager.startThread();
      const outputSchema = {
        type: "object",
        properties: { answer: { type: "string" } },
        required: ["answer"],
        additionalProperties: false,
      };
      const run = (text: string) =>
        manager.runStructuredTurn({
          threadId,
          input: [{ type: "text" as const, text }],
          outputSchema,
        });

      assert.equal((await run("fail")).status, "failed");
      assert.equal((await run("interrupt")).status, "interrupted");
      assert.equal((await run("invalid-json")).status, "invalid-output");
      assert.equal((await run("timeout")).status, "timed-out");
    },
    { turnTimeoutMs: 20 },
  );
});
