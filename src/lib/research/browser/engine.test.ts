import assert from "node:assert/strict";
import test from "node:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { recognizeCaptcha } from "./engine";

test("malformed engine output reports a bounded error and releases the recognition slot", { skip: process.platform === "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "studio-engine-test-"));
  const executable = join(directory, "engine");
  const previous = process.env.CONTENT_STUDIO_CAPTCHA_EXECUTABLE;
  process.env.CONTENT_STUDIO_CAPTCHA_EXECUTABLE = executable;
  const output = async (value: string) => {
    await writeFile(executable, `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(value)});\n`);
    await chmod(executable, 0o755);
  };
  try {
    await output("malformed diagnostic output");
    await assert.rejects(recognizeCaptcha("slider", Buffer.from("bg"), Buffer.from("piece")), /local CAPTCHA engine returned invalid JSON/);
    await output("null");
    await assert.rejects(recognizeCaptcha("slider", Buffer.from("bg"), Buffer.from("piece")), /no recognition result/);
    await output('{"code":0,"data":{"x":12}}');
    assert.deepEqual(await recognizeCaptcha("slider", Buffer.from("bg"), Buffer.from("piece")), { x: 12 });
  } finally {
    if (previous === undefined) delete process.env.CONTENT_STUDIO_CAPTCHA_EXECUTABLE;
    else process.env.CONTENT_STUDIO_CAPTCHA_EXECUTABLE = previous;
    await rm(directory, { recursive: true, force: true });
  }
});
