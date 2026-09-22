import assert from "node:assert/strict";
import test from "node:test";
import { getCodexCommand } from "./command";

test("runs the Codex executable directly on non-Windows platforms", () => {
  assert.deepEqual(getCodexCommand("darwin", {}), {
    command: "codex",
    args: ["app-server"],
  });
});

test("runs the default Windows shim through cmd.exe", () => {
  assert.deepEqual(getCodexCommand("win32", { ComSpec: "C:\\Windows\\cmd.exe" }), {
    command: "C:\\Windows\\cmd.exe",
    args: ["/d", "/s", "/c", "codex.cmd app-server"],
  });
  assert.equal(getCodexCommand("win32", {}).command, "cmd.exe");
});

test("runs a configured Codex executable directly on every platform", () => {
  assert.deepEqual(
    getCodexCommand("win32", { CODEX_BIN: "C:\\Codex Tools\\codex.exe" }),
    {
      command: "C:\\Codex Tools\\codex.exe",
      args: ["app-server"],
    },
  );
});
