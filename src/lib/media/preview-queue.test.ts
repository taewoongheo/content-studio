import assert from "node:assert/strict";
import test from "node:test";
import { serializePreview } from "@/lib/media/preview-queue";

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

test("대기 작업 취소는 즉시 반환하고 다음 작업이 실행 중인 렌더를 추월하지 않는다", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const first = serializePreview(async () => { started(); await gate; });
  await ready;
  const controller = new AbortController(); let rendered = false, nextStarted = false;
  const cancelled = serializePreview(async () => { rendered = true; }, controller.signal);
  const next = serializePreview(async () => { nextStarted = true; });
  controller.abort(new Error("cancel queued")); await assert.rejects(cancelled, /cancel queued/);
  assert.equal(nextStarted, false); release(); await Promise.all([first, next]); assert.equal(rendered, false);
});

test("이미 취소된 대기 요청은 실행하지 않고 활성 요청의 실패 뒤에도 다음 작업을 실행한다", async () => {
  const controller = new AbortController(); controller.abort(new Error("already cancelled"));
  let ran = false;
  await assert.rejects(serializePreview(async () => { ran = true; }, controller.signal), /already cancelled/);
  assert.equal(ran, false);
  const active = new AbortController(); let started!: () => void;
  const ready = new Promise<void>(resolve => { started = resolve; });
  const work = serializePreview(() => new Promise<void>((_, reject) => {
    active.signal.addEventListener("abort", () => reject(active.signal.reason), { once: true }); started();
  }), active.signal);
  await ready;
  const next = serializePreview(async () => "next");
  active.abort(new Error("cancel active")); await assert.rejects(work, /cancel active/);
  assert.equal(await next, "next");
});
