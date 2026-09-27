import assert from "node:assert/strict";
import test from "node:test";
import { monthCells } from "./calendar-model";

test("달력은 월요일부터 시작하고 윤년 마지막 날까지 표시한다", () => {
  const cells = monthCells(2024, 1);
  assert.equal(cells[0], null);
  assert.equal(cells[3], "2024-02-01");
  assert.ok(cells.includes("2024-02-29"));
  assert.equal(cells.length % 7, 0);
});

test("일요일 시작 월은 앞에 빈 칸 여섯 개를 둔다", () => {
  const cells = monthCells(2026, 10);
  assert.equal(cells[6], "2026-11-01");
});
