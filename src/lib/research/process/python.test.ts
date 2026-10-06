import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { PythonWorkerError, runPythonWorker } from "./python";

test("private worker IPC handles split Unicode, bounds output, redacts failures and cancels hung children", async () => {
  const directory = await mkdtemp(join(tmpdir(), "research-ipc-"));
  const original = process.env.CONTENT_STUDIO_RESEARCH_PYTHON;
  const script = join(directory, "fixture.mjs");
  try {
    process.env.CONTENT_STUDIO_RESEARCH_PYTHON = process.execPath;
    await writeFile(script, `import { readFileSync } from 'node:fs';
const mode = process.argv[2];
if (mode === 'unicode') {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const bytes = Buffer.from(JSON.stringify(input));
  process.stdout.write(bytes.subarray(0, 10));
  setTimeout(() => process.stdout.write(bytes.subarray(10)), 10);
} else if (mode === 'large') process.stdout.write('a'.repeat(2_000_001));
else if (mode === 'failed') { console.error('fixture-private-cookie'); process.exit(1); }
else setInterval(() => {}, 1000);
`);
    const run = (mode: string, signal?: AbortSignal, timeoutMs = 1000) => runPythonWorker({ script: relative(process.cwd(), script), args: [mode],
      input: JSON.stringify({ text: "한글" }), signal, timeoutMs });
    assert.deepEqual(JSON.parse(await run("unicode")), { text: "한글" });
    for (const [mode, reason] of [["large", "output_limit"], ["failed", "source_error"], ["hang", "timeout"]] as const) {
      await assert.rejects(run(mode, undefined, mode === "hang" ? 50 : 1000), error =>
        error instanceof PythonWorkerError && error.reason === reason && !error.message.includes("fixture-private-cookie"));
    }
    const controller = new AbortController();
    const pending = run("hang", controller.signal);
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(pending, error => error instanceof PythonWorkerError && error.reason === "cancelled");
    await assert.rejects(run("hang", controller.signal), error => error instanceof PythonWorkerError && error.reason === "cancelled");
  } finally {
    if (original === undefined) delete process.env.CONTENT_STUDIO_RESEARCH_PYTHON;
    else process.env.CONTENT_STUDIO_RESEARCH_PYTHON = original;
    await rm(directory, { recursive: true, force: true });
  }
});
