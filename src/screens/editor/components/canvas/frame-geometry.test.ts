import assert from "node:assert/strict";
import test from "node:test";
import { moveOrResizeFrame } from "./frame-geometry";

const frame = { x: 0.2, y: 0.2, width: 0.3, height: 0.2 };

test("이동은 크기를 유지하고 슬라이드 밖으로 나가지 않는다", () => {
  assert.deepEqual(moveOrResizeFrame(frame, "move", 1, 1), { x: 0.7, y: 0.8, width: 0.3, height: 0.2 });
  assert.deepEqual(moveOrResizeFrame(frame, "move", -1, -1), { x: 0, y: 0, width: 0.3, height: 0.2 });
});

test("중앙선에 가까우면 맞춰 붙고 다른 위치에는 스냅되지 않는다", () => {
  assert.deepEqual(moveOrResizeFrame(frame, "move", 0.145, 0.19), { x: 0.35, y: 0.4, width: 0.3, height: 0.2 });
  assert.deepEqual(moveOrResizeFrame(frame, "move", 0.164, 0), { x: 0.35, y: 0.2, width: 0.3, height: 0.2 });
  assert.deepEqual(moveOrResizeFrame(frame, "move", 0.168, 0), { x: 0.368, y: 0.2, width: 0.3, height: 0.2 });
  assert.deepEqual(moveOrResizeFrame(frame, "move", -0.09, -0.07),
    { x: 0.11, y: 0.13, width: 0.3, height: 0.2 });
});

test("가이드를 끄면 중앙선에 맞춰 붙지 않는다", () => {
  assert.deepEqual(moveOrResizeFrame(frame, "move", 0.145, 0.19, false), { x: 0.345, y: 0.39, width: 0.3, height: 0.2 });
});

test("크기 조절도 중앙선에 맞춰 붙는다", () => {
  assert.deepEqual(moveOrResizeFrame(frame, "se", 0.005, 0.095),
    { x: 0.2, y: 0.2, width: 0.3, height: 0.3 });
  assert.deepEqual(moveOrResizeFrame(frame, "se", 0.014, 0),
    { x: 0.2, y: 0.2, width: 0.3, height: 0.2 });
  assert.deepEqual(moveOrResizeFrame(frame, "se", 0.018, 0),
    { x: 0.2, y: 0.2, width: 0.318, height: 0.2 });
});

test("모서리 크기 조절은 반대쪽 모서리를 고정하고 최소 크기를 보장한다", () => {
  assert.deepEqual(moveOrResizeFrame(frame, "nw", 0.1, 0.05), { x: 0.3, y: 0.25, width: 0.2, height: 0.15 });
  assert.deepEqual(moveOrResizeFrame(frame, "se", 1, 1), { x: 0.2, y: 0.2, width: 0.8, height: 0.8 });
  const smallest = moveOrResizeFrame(frame, "nw", 1, 1);
  assert.ok(smallest.width >= 0.04 && smallest.height >= 0.04);
  assert.ok(smallest.x + smallest.width <= 1 && smallest.y + smallest.height <= 1);
});

test("소수점 프레임을 끝까지 이동하거나 늘려도 경계를 넘지 않는다", () => {
  const uneven = { x: 0.12345, y: 0.23456, width: 0.33333, height: 0.22222 };
  const moved = moveOrResizeFrame(uneven, "move", 1, 1);
  const resized = moveOrResizeFrame(uneven, "se", 1, 1);
  for (const result of [moved, resized]) {
    assert.ok(result.x + result.width <= 1);
    assert.ok(result.y + result.height <= 1);
  }
});
