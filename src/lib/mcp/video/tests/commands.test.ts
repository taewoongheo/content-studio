import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { newVideoDocument, layerSchema, videoDocumentSchema } from "../../../video/domain/model";
import { changeVideoFps } from "../../../video/domain/settings";
import { applyVideoCommand } from "../commands";
import { layerPatchSchema, videoCommandsSchema } from "../schema";

test("모든 영상 요소 속성이 MCP 수정 스키마에 노출되며 알 수 없는 속성은 거부된다", () => {
  const exposed = new Set(Object.keys(layerPatchSchema.shape));
  for (const schema of layerSchema.options) for (const property of Object.keys(schema.shape))
    if (property !== "id" && property !== "kind") assert.ok(exposed.has(property), `${schema.shape.kind.value}.${property}`);
  assert.equal(videoCommandsSchema.safeParse([{ type: "update_layer", layerId: randomUUID(), changes: { madeUp: 1 } }]).success, false);
});
test("텍스트·도형 생성, 모든 스타일 수정, 복제·정렬·삭제를 명령 묶음으로 처리한다", () => {
  const text = randomUUID(), shape = randomUUID(), copy = randomUUID();
  let doc = applyVideoCommand(newVideoDocument(), { type: "add_layer", layer: { kind: "text", id: text } });
  doc = applyVideoCommand(doc, { type: "add_layer", layer: { kind: "shape", id: shape } });
  doc = applyVideoCommand(doc, { type: "update_layer", layerId: text, changes: {
    text: "Hello", fontFamily: "Inter", fontWeight: 900, fontSize: 88, italic: true, align: "right",
    color: "#123456", backgroundColor: "#654321", backgroundOpacity: 0.5, borderRadius: 12,
    lineHeight: 1.3, paddingX: 15, paddingY: 10, fadeIn: 15, x: 10, y: 20, width: 300, height: 200, rotation: 15, opacity: 0.8,
  } });
  doc = applyVideoCommand(doc, { type: "update_layer", layerId: shape, changes: { shape: "ellipse", color: "#FF0000", strokeColor: "#00FF00", strokeWidth: 5, borderRadius: 20 } });
  assert.throws(() => applyVideoCommand(doc, { type: "update_layer", layerId: shape, changes: { text: "wrong kind" } }));
  doc = applyVideoCommand(doc, { type: "duplicate_layer", layerId: text, newLayerId: copy });
  assert.equal(doc.layers[2].kind === "text" && doc.layers[2].fontWeight, 900);
  doc = applyVideoCommand(doc, { type: "reorder_layers", layerIds: [copy, shape, text] });
  assert.equal(doc.layers[0].id, copy);
  assert.throws(() => applyVideoCommand(doc, { type: "reorder_layers", layerIds: [copy, copy, text] }));
  doc = applyVideoCommand(doc, { type: "remove_layer", layerId: copy });
  assert.equal(doc.layers.length, 2);
  assert.equal(videoDocumentSchema.safeParse(doc).success, true);
});
test("FPS 변경은 소스 트림·페이드·연결 시작 기준까지 시간을 유지한다", () => {
  const source = newVideoDocument();
  let doc = applyVideoCommand(source, { type: "add_layer", layer: { kind: "video", id: randomUUID(), name: "clip", from: 300, duration: 60,
    x: 0, y: 0, width: 1080, height: 1920, rotation: 0, opacity: 1, assetId: randomUUID(), sourceFrames: 120,
    trimStart: 30, trimEnd: 90, volume: 0.5, loop: false, sequence: true, sequenceIndex: 0, sequenceStart: 300, fit: "contain", cropX: 30, cropY: 60 } });
  doc = applyVideoCommand(doc, { type: "add_layer", layer: { kind: "text", fadeIn: 15 } });
  const changed = applyVideoCommand(doc, { type: "set_document", changes: { fps: 60, width: 1920, height: 1080, backgroundColor: "#112233" } });
  assert.equal(changed.layers[0].from, 600);
  assert.equal(changed.layers[0].kind === "video" && changed.layers[0].trimStart, 60);
  assert.equal(changed.layers[0].kind === "video" && changed.layers[0].sequenceStart, 600);
  assert.equal(changed.layers[1].kind === "text" && changed.layers[1].fadeIn, 30);
  assert.equal(videoDocumentSchema.safeParse(changed).success, true);
  assert.deepEqual(changeVideoFps(changed, 30).layers, doc.layers);
});
