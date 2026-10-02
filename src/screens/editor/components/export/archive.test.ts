import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { createSlideArchive, exportDimensions, slideFilename } from "./archive";

test("문서 비율을 게시용 픽셀 크기로 변환한다", () => {
  assert.deepEqual(exportDimensions("4:5"), { width: 1080, height: 1350 });
  assert.deepEqual(exportDimensions("1:1"), { width: 1080, height: 1080 });
  assert.deepEqual(exportDimensions("9:16"), { width: 1080, height: 1920 });
});

test("슬라이드 수에 맞는 순번 파일명을 만든다", () => {
  assert.equal(slideFilename(0, 6), "slide-01.png");
  assert.equal(slideFilename(99, 100), "slide-100.png");
});

test("브라우저에서 생성한 PNG들을 무압축 ZIP으로 묶는다", async () => {
  const archive = await createSlideArchive([new Uint8Array([1, 2]), new Uint8Array([3, 4])]);
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());
  assert.deepEqual(Object.keys(zip.files), ["slide-01.png", "slide-02.png"]);
  assert.deepEqual([...await zip.file("slide-02.png")!.async("uint8array")], [3, 4]);
});
