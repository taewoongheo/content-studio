import assert from "node:assert/strict";
import test from "node:test";
import { imagePickerPosition } from "./picker-position";

test("상단 패널 버튼은 여유 있는 아래로 이미지 목록을 연다", () => {
  const position = imagePickerPosition({ left: 280, top: 160, bottom: 192 }, { width: 1440, height: 900 });
  assert.equal(position.top, 200);
  assert.equal(position.maxHeight, 480);
  assert.equal(position.bottom, undefined);
});

test("하단 버튼은 위로 열고 목록은 화면 경계 안에 들어간다", () => {
  const position = imagePickerPosition({ left: 1200, top: 750, bottom: 782 }, { width: 1440, height: 900 });
  assert.equal(position.bottom, 158);
  assert.equal(position.top, undefined);
  assert.equal(position.left + position.width, 1424);
  assert.equal(position.maxHeight, 480);
});

test("좁은 화면도 목록 폭과 높이를 실제 가용 공간으로 제한한다", () => {
  const position = imagePickerPosition({ left: 250, top: 80, bottom: 112 }, { width: 320, height: 400 });
  assert.equal(position.width, 288);
  assert.equal(position.left, 16);
  assert.equal(position.top, 120);
  assert.equal(position.maxHeight, 264);
});
