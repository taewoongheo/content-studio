import assert from "node:assert/strict";
import test from "node:test";
import { serializePreview } from "../preview/queue";

test("동시 미리보기는 순서대로 실행하고 실패 뒤에도 다음 요청을 처리한다", async () => {
  const events: string[] = [];
  let releaseFirst!: () => void;
  const gate = new Promise<void>((resolve) => { releaseFirst = resolve; });
  let firstStarted!: () => void;
  const started = new Promise<void>((resolve) => { firstStarted = resolve; });
  const first = serializePreview(async () => {
    events.push("first start");
    firstStarted();
    await gate;
    events.push("first finish");
    return "first";
  });
  const failed = assert.rejects(serializePreview(async () => {
    events.push("second start");
    throw new Error("render failed");
  }), /render failed/);
  const third = serializePreview(async () => {
    events.push("third start");
    return "third";
  });
  await started;
  assert.deepEqual(events, ["first start"]);
  releaseFirst();
  assert.deepEqual(await Promise.all([first, failed, third]), ["first", undefined, "third"]);
  assert.deepEqual(events, ["first start", "first finish", "second start", "third start"]);
});
