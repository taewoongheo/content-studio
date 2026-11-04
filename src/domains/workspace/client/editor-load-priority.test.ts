import test from "node:test";
import assert from "node:assert/strict";
import { editorLoadPriority, subscribeBackgroundEvents } from "./editor-load-priority";

test("foreground work closes streams until all reservations end and cleanup prevents reconnect", () => {
  let connections = 0;
  let closed = 0;
  const stop = subscribeBackgroundEvents(() => { connections++; return () => { closed++; }; });
  assert.equal(connections, 1);
  const releaseSave = editorLoadPriority.begin();
  const releaseLoad = editorLoadPriority.begin();
  assert.equal(closed, 1);
  releaseSave();
  assert.equal(connections, 1);
  releaseLoad();
  assert.equal(connections, 2);
  stop();
  assert.equal(closed, 2);
  editorLoadPriority.begin()();
  assert.equal(connections, 2);
});
