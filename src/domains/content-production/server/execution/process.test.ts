import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stagePolicy } from "./policy/stages";
import { runCodex } from "./process";

test("제작 CLI는 실행별 웹 검색과 작업 전용 MCP를 사용하고 읽기 전용 권한을 유지한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "production-cli-test-"));
  const executable = join(directory, "codex.cjs"), argsPath = join(directory, "args.json");
  const previous = process.env.CONTENT_STUDIO_CODEX_BIN;
  const threadIds:string[] = [];
  const toolEvents: Array<{callId:string;name:string;result?:{isError?:boolean}}> = [];
  try {
    await writeFile(executable, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "mcp") {
  console.log(JSON.stringify([{name:"other",enabled:true,transport:{url:"http://127.0.0.1:9999/mcp"}}]));
} else {
  console.log(JSON.stringify({type:"thread.started",thread_id:"test-image-thread"}));
  console.log(JSON.stringify({type:"item.started",item:{type:"mcp_tool_call",id:"tool-1",tool:"production_preview_project",arguments:{projectId:"source"}}}));
  console.log(JSON.stringify({type:"item.completed",item:{type:"mcp_tool_call",id:"tool-1",tool:"production_preview_project",arguments:{projectId:"source"},error:{message:"Connection refused"},result:null}}));
  fs.writeFileSync(${JSON.stringify(argsPath)},JSON.stringify(args));
  fs.writeFileSync(args[args.indexOf("--output-last-message")+1],JSON.stringify({ok:true}));
}
`, { mode: 0o700 });
    process.env.CONTENT_STUDIO_CODEX_BIN = executable;
    const result = await runCodex({ capabilities: stagePolicy("production"), prompt: "test", schema: {}, origin: "http://127.0.0.1:3000",
      onThreadStarted:id=>threadIds.push(id),
      images: ["/tmp/turnaround.png", "/tmp/face.png", "/tmp/example.png"],
      taskId: "task", token: "test-token", signal: new AbortController().signal, onActivity() {}, onToolActivity(event) { toolEvents.push(event); } });
    assert.deepEqual(result, { ok: true });
    assert.deepEqual(threadIds,["test-image-thread"]);
    assert.equal(toolEvents.length,2);
    assert.equal(toolEvents[0].result,undefined);
    assert.equal(toolEvents[1].result?.isError,true);
    const args: string[] = JSON.parse(await readFile(argsPath, "utf8"));
    assert.deepEqual(args.flatMap((value, index) => value === "--image" ? [args[index + 1]] : []), ["/tmp/turnaround.png", "/tmp/face.png", "/tmp/example.png"]);
    assert.equal(args[args.indexOf("--sandbox") + 1], "read-only");
    const overrides = args.flatMap((value, index) => value === "-c" ? [args[index + 1]] : []);
    assert.ok(overrides.includes('web_search="live"'));
    assert.ok(overrides.includes("features.image_generation=true"));
    assert.ok(overrides.includes("mcp_servers.other.enabled=false"));
    assert.ok(overrides.includes("mcp_servers.production.enabled=true"));
    assert.ok(overrides.includes('mcp_servers.production.url="http://127.0.0.1:3000/api/content-production/agent/task"'));
    assert.equal(args.includes("test-token"), false);
    for (const step of ["analysis","visual","hook","polish"] as const) {
      await runCodex({capabilities:stagePolicy(step),prompt:"Check stage capabilities",schema:{},origin:"http://127.0.0.1:3000",
        taskId:"task",token:"test-token",signal:new AbortController().signal,onActivity() {}});
      const stageArgs:string[] = JSON.parse(await readFile(argsPath,"utf8"));
      const values=stageArgs.flatMap((value,index)=>value==="-c"?[stageArgs[index+1]]:[]);
      assert.ok(values.includes("features.image_generation=false"));
      assert.ok(values.includes(step === "hook" ? 'web_search="live"' : 'web_search="disabled"'));
      assert.equal(values.includes("features.shell_tool=false"),step !== "hook");
      assert.equal(values.includes("features.unified_exec=false"),step !== "hook");
    }
    await runCodex({ prompt: "Analyze attached slide text", schema: {}, origin: "", taskId: "", token: "", standalone: true,
      images: ["/tmp/persona-slide.webp"], signal: new AbortController().signal, onActivity() {} });
    const personaArgs: string[] = JSON.parse(await readFile(argsPath, "utf8"));
    assert.ok(personaArgs.includes("--skip-git-repo-check"));
    assert.ok(personaArgs.includes("/tmp/persona-slide.webp"));
    assert.ok(personaArgs.includes("features.shell_tool=false"));
    assert.ok(personaArgs.includes("mcp_servers.other.enabled=false"));
    assert.equal(personaArgs.some(value => value.startsWith("mcp_servers.production.")), false);
    await runCodex({ prompt: "Translate data only", schema: {}, origin: "", taskId: "", token: "", displayOnly: true, signal: new AbortController().signal, onActivity() {} });
    const displayArgs: string[] = JSON.parse(await readFile(argsPath, "utf8"));
    assert.equal(displayArgs.includes("--image"), false);
    const displayOverrides = displayArgs.flatMap((value, index) => value === "-c" ? [displayArgs[index + 1]] : []);
    assert.ok(displayOverrides.includes('web_search="disabled"'));
    assert.ok(displayOverrides.includes("features.image_generation=false"));
    assert.ok(displayOverrides.includes("mcp_servers.other.enabled=false"));
    assert.ok(displayOverrides.includes("features.shell_tool=false"));
    assert.ok(displayOverrides.includes("features.unified_exec=false"));
    assert.equal(displayOverrides.some(value => value.includes("/api/content-production/agent/") || value === "mcp_servers.production.enabled=true"), false);
    await assert.rejects(runCodex({ prompt:"schema mismatch",schema:{type:"object",properties:{title:{type:"string"}},required:["title"]},
      origin:"",taskId:"",token:"",displayOnly:true,signal:new AbortController().signal,onActivity() {} }),
      (error: unknown) => !!error && typeof error === "object" && "code" in error && error.code === "OUTPUT_SCHEMA_INVALID");
  } finally {
    if (previous === undefined) delete process.env.CONTENT_STUDIO_CODEX_BIN;
    else process.env.CONTENT_STUDIO_CODEX_BIN = previous;
    await rm(directory, { recursive: true, force: true });
  }
});

test("잘못된 CLI 최종 응답은 출처를 구분할 수 있는 오류로 표시한다", async () => {
  const directory = await mkdtemp(join(tmpdir(), "production-cli-output-test-"));
  const executable = join(directory, "codex.cjs");
  const previous = process.env.CONTENT_STUDIO_CODEX_BIN;
  try {
    await writeFile(executable, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "mcp") console.log("[]");
else fs.writeFileSync(args[args.indexOf("--output-last-message")+1], "First draft is complete.");
`, { mode: 0o700 });
    process.env.CONTENT_STUDIO_CODEX_BIN = executable;
    await assert.rejects(runCodex({
      prompt: "Test malformed output", schema: {}, origin: "", taskId: "", token: "",
      displayOnly: true, signal: new AbortController().signal, onActivity() {},
    }), /CLI 최종 응답이 JSON 객체 형식이 아닙니다/);
  } finally {
    if (previous === undefined) delete process.env.CONTENT_STUDIO_CODEX_BIN;
    else process.env.CONTENT_STUDIO_CODEX_BIN = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
