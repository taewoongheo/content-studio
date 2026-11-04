import test from "node:test";
import assert from "node:assert/strict";
import { assistantRequest } from "./api";
import { subscribeBackgroundEvents } from "../../client/editor-load-priority";

test("AI start, status and stop free background connections through response parsing", async () => {
  const original = globalThis.fetch;
  let connected = false;
  const dispose = subscribeBackgroundEvents(() => {
    connected = true; return () => { connected = false; };
  });
  const target = { projectId:"p",tabId:"t",projectType:"slideshow" as const };
  try {
    for (const body of [undefined, {action:"start"}, {action:"stop"}]) {
      globalThis.fetch = async (_url, options) => {
        assert.equal(connected,false);
        assert.equal(options?.method,body ? "POST" : "GET");
        return {ok:true,json:async()=>{assert.equal(connected,false);return {state:"running"};}} as Response;
      };
      assert.deepEqual(await assistantRequest(target,body),{state:"running"});
      assert.equal(connected,true);
    }
    globalThis.fetch = async () => {throw Error("offline");};
    await assert.rejects(assistantRequest(target),/offline/);
    assert.equal(connected,true);
  } finally {globalThis.fetch=original;dispose();}
});
