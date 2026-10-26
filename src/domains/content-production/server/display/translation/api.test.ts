import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { productionStore } from "../../execution/runner";

test("detail prefetch fills the sentence cache without changing drafts; node translation is unavailable", async () => {
  const directory = mkdtempSync(join(tmpdir(), "translation-api-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  process.env.CONTENT_STUDIO_PRODUCTION_RUNTIME_DIR = directory;
  const executable = join(directory, "codex.cjs"), calls = join(directory, "calls.json");
  process.env.CONTENT_STUDIO_CODEX_BIN = executable;
  writeFileSync(executable, `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
if (args[0] === "mcp") console.log("[]");
else {
 let prompt="";
 process.stdin.on("data", chunk => prompt+=chunk);
 process.stdin.on("end", () => {
  const calls = fs.existsSync(${JSON.stringify(calls)}) ? JSON.parse(fs.readFileSync(${JSON.stringify(calls)},"utf8")) : [];
  calls.push(prompt);fs.writeFileSync(${JSON.stringify(calls)},JSON.stringify(calls));
  if(args[args.indexOf("--model")+1]!=="gpt-6-luna")process.exit(2);
 const schema = JSON.parse(fs.readFileSync(args[args.indexOf("--output-schema")+1],"utf8"));
  fs.writeFileSync(args[args.indexOf("--output-last-message")+1],JSON.stringify(Object.fromEntries(Object.keys(schema.properties).map(key=>[key,"근력 운동"]))));
 });
}
`, { mode: 0o700 });
  const store = productionStore();
  try {
    const { POST } = await import("@/app/api/content-production/route");
    const ids = store.create(2);
    for (const id of ids) {
      store.state(id, "running");
      store.completeAnalysis(id, { analysis: "An actionable plan for readers.", topic: "Build muscle", content_type: "routine", message: "Train consistently",
        answer: "Use progressive training", presentation: "cards", reason: "useful", expected_response: "save", goal_connection: "install", difference_from_recent: "new", sources: [] });
    }
    const before = ids.map(id => store.get(id));
    const post = (body: unknown) => POST(new Request("http://127.0.0.1:3000/api/content-production", {
      method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "Content-Type": "application/json" }, body: JSON.stringify(body),
    }));
    const first=await post({action:"translate_display",id:ids[0],step:"analysis"});
    assert.equal(first.status,200);
    const data=await first.json();
    assert.equal(data.source.analysis,"An actionable plan for readers.");
    assert.equal(data.translated.analysis,"근력 운동");
    const prompts=JSON.parse(readFileSync(calls,"utf8")) as string[];
    assert.equal(prompts.length,1);assert.ok(prompts[0].includes("An actionable plan for readers."));
    assert.equal((await post({action:"translate_display",id:ids[1],step:"analysis"})).status,200);
    assert.equal(JSON.parse(readFileSync(calls,"utf8")).length,1,"cached detail sentences are reused across tasks");
    assert.equal((await post({action:"translate_canvas",items:[{id:ids[0],step:"analysis"}]})).status,400);
    const stream=await post({action:"translate_display",id:ids[0],step:"analysis",stream:true});
    assert.match(stream.headers.get("content-type")!,/application\/x-ndjson/);
    const events=(await stream.text()).trim().split("\n").map(line=>JSON.parse(line));
    assert.ok(events.some(event=>event.field==="analysis" && event.translated==="근력 운동"));
    assert.equal(events.at(-1).type,"done");
    assert.deepEqual(ids.map(id => store.get(id)), before);
  } finally { store.db.close(); rmSync(directory, { recursive: true, force: true }); }
});
