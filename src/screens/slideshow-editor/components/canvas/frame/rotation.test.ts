import assert from "node:assert/strict";
import test from "node:test";
import { moveOrResizeRotatedFrame } from "./rotation";

const frame = { x: 0.2, y: 0.3, width: 0.3, height: 0.2 };
function corner(f: typeof frame, rotation: number, west: boolean, north: boolean) {
  const radians = rotation * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const dx = f.width * 1080 / 2 * (west ? -1 : 1), dy = f.height * 1350 / 2 * (north ? -1 : 1);
  return { x: (f.x + f.width / 2) * 1080 + cos * dx - sin * dy,
    y: (f.y + f.height / 2) * 1350 + sin * dx + cos * dy };
}
test("회전된 네 모서리는 반대 모서리를 고정하고 로컬 축을 따라 크기를 바꾼다", () => {
  for (const rotation of [-135, -45, 90, 180]) for (const mode of ["nw", "ne", "sw", "se"] as const) {
    const next = moveOrResizeRotatedFrame(frame, mode, 30, 40, 1080, 1350, rotation, true, false);
    const a = corner(frame, rotation, mode.includes("e"), mode.includes("s"));
    const b = corner(next, rotation, mode.includes("e"), mode.includes("s"));
    assert.ok(Math.abs(a.x - b.x) < 0.1 && Math.abs(a.y - b.y) < 0.1);
    assert.ok(next.width >= 0.04 && next.height >= 0.04);
  }
});
test("회전된 이미지 비율 잠금과 화면 좌표 이동을 유지한다", () => {
  const next = moveOrResizeRotatedFrame(frame, "se", 100, 30, 1080, 1350, 90, false, true);
  assert.ok(Math.abs(next.width / next.height - 1.5) < 0.001);
  assert.deepEqual(moveOrResizeRotatedFrame(frame, "move", 108, 135, 1080, 1350, 90, false, false),
    { ...frame, x: 0.3, y: 0.4 });
});
