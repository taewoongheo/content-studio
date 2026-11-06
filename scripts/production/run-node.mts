import { parseArgs } from "node:util";
import { standaloneStepSchema, type WorkDetail } from "../../src/domains/content-production/domain/contracts";

const { values } = parseArgs({ options: {
  id: { type: "string" }, step: { type: "string" },
  origin: { type: "string", default: "http://127.0.0.1:3000" },
  timeout: { type: "string", default: "1200" },
} });
if (!values.id || !standaloneStepSchema.safeParse(values.step).success)
  throw new Error("Usage: pnpm node:run --id DRAFT_ID --step analysis|hook|visual");
const origin = new URL(values.origin).origin, id = values.id;
const timeout = Number(values.timeout) * 1000;
if (!Number.isFinite(timeout) || timeout < 1000 || timeout > 3600000)
  throw new Error("timeout must be 1–3600 seconds");
async function request(action?: string) {
  const response = await fetch(`${origin}/api/content-production${action ? "" : `?id=${encodeURIComponent(id)}`}`, {
    ...(action ? { method: "POST", headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ action, id, step: values.step }) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
}
await request("run_node");
let interrupted = false, previous = "";
process.once("SIGINT", () => { interrupted = true; });
process.once("SIGTERM", () => { interrupted = true; });
const deadline = Date.now() + timeout;
while (true) {
  const detail = await request() as WorkDetail, state = detail.task.state;
  if (state !== previous) {
    console.log(JSON.stringify({ id, step: detail.task.current_step, state, project_id: detail.task.project_id }));
    previous = state;
  }
  if (["finished", "failed", "stopped"].includes(state)) {
    if (state !== "finished") {
      console.error(JSON.stringify(detail[detail.task.current_step]?.error ?? state));
      process.exitCode = 1;
    }
    break;
  }
  if (interrupted || Date.now() > deadline) {
    await request("stop");
    throw new Error("Node stopped; saved draft edits remain in the app.");
  }
  await new Promise(resolve => setTimeout(resolve, 3000));
}
