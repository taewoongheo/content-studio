import assert from "node:assert/strict";
import test from "node:test";
import { makeElementDefinition } from "@/lib/content-jobs/editor/elements/factory";
import { shapeGeometry, roundedTrianglePath } from "./geometry";

const shape = makeElementDefinition({ id: "shape", kind: "rectangle", });

test("투명 도형은 테두리만 렌더링하며 테두리는 프레임 안쪽에 위치한다", () => {
  const geometry = shapeGeometry(200, 100, { ...shape.style, backgroundColor: "transparent",
    borderEnabled: true, borderColor: "#FF0000", borderWidth: 10, borderRadius: 20 });
  assert.deepEqual(geometry, { x: 5, y: 5, width: 190, height: 90, radius: 15,
    fill: "transparent", stroke: "#FF0000", strokeWidth: 10, strokeEnabled: true });
  assert.equal(geometry.x - geometry.strokeWidth / 2, 0);
  assert.equal(geometry.x + geometry.width + geometry.strokeWidth / 2, 200);
});

test("테두리를 끄거나 두께를 0으로 설정하면 선이 사라지고 설정값은 유지한다", () => {
  const style = { ...shape.style, borderColor: "#0000FF", borderWidth: 8, borderEnabled: false };
  const geometry = shapeGeometry(200, 100, style);
  assert.equal(geometry.strokeEnabled, false);
  assert.equal(geometry.width, 200);
  assert.equal(shapeGeometry(200, 100, { ...style, borderEnabled: true, borderWidth: 0 }).strokeEnabled, false);
  assert.equal(shapeGeometry(200, 100, { ...style, borderEnabled: true }).strokeWidth, 8);
  const legacy = { ...shape.style };
  delete legacy.borderEnabled;
  assert.equal(shapeGeometry(200, 100, legacy).strokeEnabled, false);
});

test("작은 도형의 테두리와 반경은 프레임 크기로 제한하고 삼각형도 둥근 경로를 만든다", () => {
  const geometry = shapeGeometry(4, 8, { ...shape.style, borderWidth: 100, borderRadius: 100 });
  assert.equal(geometry.strokeWidth, 4);
  assert.equal(geometry.width, 0);
  assert.equal(geometry.radius, 0);
  const square = roundedTrianglePath(100, 100, 0);
  const rounded = roundedTrianglePath(100, 100, 20);
  assert.notEqual(square, rounded);
  assert.ok(rounded.startsWith("M ") && rounded.endsWith(" Z"));
  assert.equal((rounded.match(/Q /g) ?? []).length, 3);
  assert.ok(!roundedTrianglePath(0, 0, 100).includes("NaN"));
});
