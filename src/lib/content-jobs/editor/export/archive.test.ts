import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import sharp from "sharp";
import { ensureSharedBackground } from "../document";
import type { EditorDocument, ElementStyle } from "../types";
import { createEditorArchive } from "./archive";
import { exportDimensions } from "./render";

const style: ElementStyle = {
  color: "#111111",
  backgroundColor: "transparent",
  fontSize: 42,
  lineHeight: 1.2,
  fontWeight: 700,
  textAlign: "center",
  borderRadius: 0,
  fontFamily: "sans-serif",
  imageFit: "cover",
};

function documentFixture() {
  const document: EditorDocument = {
    version: 1,
    structure: "sequential",
    aspectRatio: "4:5",
    formatNotes: { visualRules: "규칙", writingStyle: "문체", hookPattern: "훅", bodyProgression: "전개" },
    elements: [
      { id: "empty-text", name: "내보내면 안 되는 슬롯명", role: "빈 텍스트", kind: "text",
        frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, style, sourceImageId: "reference-1" },
      { id: "image", name: "이미지", role: "이미지", kind: "image",
        frame: { x: 0.25, y: 0.25, width: 0.5, height: 0.4 }, style, sourceImageId: "reference-1" },
      { id: "outside", name: "밖의 도형", role: "가장자리 장식", kind: "rectangle",
        frame: { x: -0.1, y: 0.9, width: 0.3, height: 0.2 },
        style: { ...style, backgroundColor: "#FF0000" }, sourceImageId: "reference-2" },
    ],
    slides: [
      { id: "slide-1", role: "hook", backgroundColor: "#FFFFFF", placements: [
        { id: "text-1", elementId: "empty-text", value: "", frameOverride: null, styleOverride: null },
        { id: "image-1", elementId: "image", value: "blue", frameOverride: null, styleOverride: null },
      ] },
      { id: "slide-2", role: "cta", backgroundColor: "#FFFFFF", placements: [
        { id: "text-2", elementId: "empty-text", value: "내보내기 제목", frameOverride: null, styleOverride: null },
        { id: "outside-1", elementId: "outside", value: "", frameOverride: null, styleOverride: null },
      ] },
    ],
  };
  return ensureSharedBackground(document);
}

test("문서 비율을 게시용 픽셀 크기로 변환한다", () => {
  assert.deepEqual(exportDimensions("4:5"), { width: 1080, height: 1350 });
  assert.deepEqual(exportDimensions("1:1"), { width: 1080, height: 1080 });
  assert.deepEqual(exportDimensions("9:16"), { width: 1080, height: 1920 });
});

test("편집 문서를 해상도별 PNG 파일이 든 ZIP으로 내보낸다", async () => {
  const blue = await sharp({ create: { width: 20, height: 20, channels: 4, background: "#0000FF" } }).png().toBuffer();
  const archive = await createEditorArchive(documentFixture(), async (assetId) => {
    assert.equal(assetId, "blue");
    return { bytes: blue, type: "image/png" };
  });
  const zip = await JSZip.loadAsync(archive);
  assert.deepEqual(Object.keys(zip.files), ["slide-01.png", "slide-02.png"]);
  const first = await zip.file("slide-01.png")!.async("nodebuffer");
  const second = await zip.file("slide-02.png")!.async("nodebuffer");
  assert.deepEqual(await sharp(first).metadata().then(({ width, height }) => ({ width, height })),
    { width: 1080, height: 1350 });
  const firstCenter = await sharp(first).extract({ left: 540, top: 675, width: 1, height: 1 }).raw().toBuffer();
  assert.deepEqual([...firstCenter.slice(0, 3)], [0, 0, 255]);
  const emptyTextArea = await sharp(first).extract({ left: 540, top: 200, width: 1, height: 1 }).raw().toBuffer();
  assert.deepEqual([...emptyTextArea.slice(0, 3)], [255, 255, 255]);
  const renderedText = await sharp(second).extract({ left: 100, top: 135, width: 880, height: 270 }).stats();
  assert.ok(renderedText.channels.slice(0, 3).some((channel) => channel.min < 100));
  const outsideShape = await sharp(second).extract({ left: 1, top: 1280, width: 1, height: 1 }).raw().toBuffer();
  assert.deepEqual([...outsideShape.slice(0, 3)], [255, 0, 0]);
});
