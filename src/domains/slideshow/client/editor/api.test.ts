import test from "node:test";
import assert from "node:assert/strict";
import { postContentJobAction } from "./api";
import { subscribeBackgroundEvents } from "@/domains/workspace/client/editor-load-priority";

test("editing releases SSE connections before fetch and restores them after success or failure", async () => {
  const originalFetch = globalThis.fetch;
  let connected = false;
  const stop = subscribeBackgroundEvents(() => {
    connected = true;
    return () => { connected = false; };
  });
  try {
    for (const succeeds of [true, false]) {
      globalThis.fetch = async () => {
        assert.equal(connected, false, "the edit must not queue behind background streams");
        return { ok: succeeds, json: async () => {
          assert.equal(connected, false, "reserve the connection through body consumption");
          return succeeds ? { id: "project" } : { error: "save failed" };
        } } as Response;
      };
      if (succeeds) assert.equal((await postContentJobAction("project", { action: "editor_undo" })).id, "project");
      else await assert.rejects(postContentJobAction("project", {}), /save failed/);
      assert.equal(connected, true);
    }
  } finally { globalThis.fetch = originalFetch; stop(); }
});
