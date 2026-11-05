import { parseArgs } from "node:util";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import { mkdir, readFile, writeFile, rm, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { LOCAL_DATABASE_PATH } from "../../src/lib/local-db/database";
import type { WorkDetail } from "../../src/domains/content-production/domain/contracts";

const { values } = parseArgs({ options: {
  draft: { type: "string" }, step: { type: "string" }, output: { type: "string" },
  source: { type: "string" }, continue: { type: "boolean" }, timeout: { type: "string", default: "1200" },
} });
if (!values.draft || !["analysis", "hook", "visual"].includes(values.step ?? "") || !values.output)
  throw new Error("Usage: pnpm experiment:node --draft 28 --step visual --output /absolute/experiment [--continue] [--timeout 1200]");

const output = resolve(values.output), source = resolve(values.source ?? LOCAL_DATABASE_PATH);
const database = join(output, "experiment.sqlite"), timeout = Number(values.timeout) * 1000;
if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 3600000)
  throw new Error("timeout must be 1–3600 seconds");
if (database === source) throw new Error("Experiment DB must differ from source DB");
await mkdir(output, { recursive: true });
const exists = await stat(database).then(() => true, () => false);
if (exists && !values.continue)
  throw new Error("Output already contains an experiment. Use a new output folder or --continue.");
if (!exists && values.continue) throw new Error("No experiment snapshot to continue");
if (!exists) {
  const sourceDb = new Database(source, { readonly: true, fileMustExist: true });
  try { await sourceDb.backup(database); } finally { sourceDb.close(); }
}
const db = new Database(database, { readonly: true });
const row = db.prepare("SELECT draft_id FROM content_draft_numbers WHERE number=?").get(values.draft) as { draft_id: string } | undefined;
db.close();
if (!row) throw new Error("Draft number not found in snapshot");

const id = row.draft_id, run = join(output, new Date().toISOString().replaceAll(":", "-"));
await mkdir(run, { recursive: true });
const portServer = createServer();
await new Promise<void>(resolve => portServer.listen(0, "127.0.0.1", resolve));
const address = portServer.address();
if (!address || typeof address === "string") throw new Error("No port");
const port = address.port;
await new Promise<void>(resolve => portServer.close(() => resolve()));
const origin = `http://127.0.0.1:${port}`;
const dist = `.next-experiment-${process.pid}`, config = `.next-mcp-smoke-experiment-${process.pid}.tsconfig.json`;
await writeFile(config, await readFile("tsconfig.json"));
const child = spawn("pnpm", ["dev", "--port", String(port)], {
  env: {
    ...process.env, CONTENT_STUDIO_DB_PATH: database, CONTENT_STUDIO_EXPERIMENT: "1",
    CONTENT_STUDIO_EXPERIMENT_OUTPUT: run, CONTENT_STUDIO_DISABLE_COLLECTION: "1",
    CONTENT_STUDIO_DIST_DIR: dist, CONTENT_STUDIO_TSCONFIG_PATH: config,
  },
  stdio: ["ignore", "pipe", "pipe"], detached: true,
});
// Stream diagnostics to disk instead of retaining an entire CLI run in memory.
const log = createWriteStream(join(run, "server.log"));
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
let client: Client | undefined, signalled = false;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function get(): Promise<WorkDetail> {
  const response = await fetch(`${origin}/api/content-production?id=${id}`, { signal: AbortSignal.timeout(30000) });
  const value = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(value));
  return value;
}
async function action(body: Record<string, unknown>) {
  return fetch(`${origin}/api/content-production`, {
    method: "POST", headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ ...body, id }), signal: AbortSignal.timeout(30000),
  });
}
async function call(name: string, args: Record<string, unknown>) {
  const result = await client!.callTool({ name, arguments: args }, undefined, { timeout: 180000 });
  if (result.isError) throw new Error(JSON.stringify(result));
  return result;
}
async function capture(label: string, detail: WorkDetail) {
  await writeFile(join(run, `${label}.json`), JSON.stringify(detail, null, 2));
  const projectId = detail.task.project_id;
  if (!projectId) return;
  await call("open_project", { projectId });
  const project = await call("read_project", { projectId });
  await writeFile(join(run, `${label}-project.json`), JSON.stringify(project.structuredContent, null, 2));
  const previews = await call("preview_slides", { projectId, width: 1080 });
  let index = 0;
  for (const content of previews.content as Array<{ type: string; data?: string }>) {
    if (content.type === "image")
      await writeFile(join(run, `${label}-${String(++index).padStart(2, "0")}.png`), Buffer.from(content.data!, "base64"));
  }
  const layout = await call("inspect_slide_layout", { projectId });
  await writeFile(join(run, `${label}-layout.json`), JSON.stringify(layout.structuredContent, null, 2));
}
async function saveManifest(state: string) {
  // Preflight failure can occur before the executor has captured its prompt.
  const input = await readFile(join(run, "input.json"), "utf8").catch(() => null);
  const prompt = input ? JSON.parse(input).prompt : null;
  await writeFile(join(run, "manifest.json"), JSON.stringify({
    draft: values.draft, id, step: values.step, state,
    prompt_sha256: prompt ? createHash("sha256").update(prompt).digest("hex") : null,
    source_database: source, snapshot_database: database, continued: !!values.continue, run,
  }, null, 2));
}
async function stop() {
  signalled = true;
  try { await action({ action: "stop" }); } catch { /* The server may already have exited. */ }
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());
try {
  const start = Date.now();
  while (true) {
    if (signalled) throw new Error("Experiment interrupted before execution");
    try {
      if ((await fetch(`${origin}/mcp`, { signal: AbortSignal.timeout(5000) })).status === 405) break;
    } catch { /* Wait for the isolated development server to listen. */ }
    if (child.exitCode !== null || Date.now() - start > 90000)
      throw new Error("Experiment server failed to start; see server.log");
    await sleep(500);
  }
  client = new Client({ name: "node-experiment", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  await capture("before", await get());
  if (signalled) throw new Error("Experiment interrupted before execution");
  const response = await action({ action: "experiment", step: values.step });
  if (!response.ok) throw new Error(await response.text());
  console.log(JSON.stringify({ run, origin, draft: values.draft, step: values.step, state: "running" }));
  const deadline = Date.now() + timeout;
  let previous = "";
  while (true) {
    await sleep(3000);
    const detail = await get(), state = detail.task.state;
    if (state !== previous) {
      console.log(JSON.stringify({ state, step: detail.task.current_step }));
      previous = state;
    }
    if (["finished", "failed", "stopped"].includes(state)) {
      await capture("after", detail);
      await saveManifest(state);
      console.log(JSON.stringify({ state, artifacts: run }));
      if (state !== "finished") process.exitCode = 1;
      break;
    }
    if (Date.now() > deadline || signalled) {
      await stop();
      await writeFile(join(run, "after.json"), JSON.stringify(await get(), null, 2));
      await saveManifest("stopped");
      throw new Error("Experiment stopped at time limit or interruption; snapshot retained");
    }
  }
} finally {
  try { await client?.close(); } finally {
    if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch {} }
    if (child.exitCode === null)
      await Promise.race([new Promise<void>(resolve => child.once("exit", () => resolve())), sleep(3000)]);
    if (child.exitCode === null && child.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch {} }
    child.stdout.unpipe(log);
    child.stderr.unpipe(log);
    log.end();
    await finished(log);
    await rm(dist, { recursive: true, force: true });
    await rm(config, { force: true });
  }
}
