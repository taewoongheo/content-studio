import assert from "node:assert/strict";
import test from "node:test";
import { ContentJobRegistry } from "../../workflow/registry";
import { EditorService, EDITOR_HISTORY_LIMIT } from "../service";
import { makeElementDefinition } from "../elements/factory";

function session() {
  const registry = new ContentJobRegistry({ createId: () => "job" });
  registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 6, outputLanguage: "English" });
  return { registry, service: new EditorService(registry) };
}

test("회전은 개별 덮어쓰기와 공통 변경, 되돌리기에서 유지된다", () => {
  const { service } = session();
  const definition = makeElementDefinition({ id: "arrow", kind: "triangle" });
  definition.style.rotation = 90;
  service.applyCommands("job", [{ type: "add_element", element: definition },
    { type: "place_element", slideId: "slide-1", elementId: "arrow", placementId: "a" },
    { type: "place_element", slideId: "slide-2", elementId: "arrow", placementId: "b" }], 0);
  service.applyCommands("job", [{ type: "update_visual", scope: "local", slideId: "slide-1", placementId: "a",
    style: { rotation: -45 } }], 1);
  const common = service.applyCommands("job", [{ type: "update_visual", scope: "common", elementId: "arrow", style: { rotation: 180 } }], 2);
  assert.equal(common.editor.document.elements.find(e => e.id === "arrow")?.style.rotation, 180);
  assert.equal(common.editor.document.slides[0].placements.find(p => p.id === "a")?.styleOverride, null);
  const restored = service.undo("job", 3);
  assert.equal(restored.editor.document.elements.find(e => e.id === "arrow")?.style.rotation, 90);
  assert.equal(restored.editor.document.slides[0].placements.find(p => p.id === "a")?.styleOverride?.rotation, -45);
});

test("긴 편집 세션은 최근 100회만 되돌리고 오래된 문서를 해제한다", () => {
  const { registry, service } = session();
  let revision = 0;
  for (let index = 1; index <= EDITOR_HISTORY_LIMIT + 5; index++) {
    revision = service.applyCommands("job", [{ type: "rename_slide", slideId: "slide-1", name: String(index) }], revision).editor.revision;
  }
  assert.equal(registry.getRecord("job").editorHistory.length, EDITOR_HISTORY_LIMIT);
  for (let index = 0; index < EDITOR_HISTORY_LIMIT; index++) {
    revision = service.undo("job", revision).editor.revision;
  }
  assert.equal(registry.get("job").editor.document.slides[0].name, "5");
  assert.throws(() => service.undo("job", revision), /되돌릴 수정이 없습니다/);
});

test("빈 문서는 AI 없이 열리며 비율 변경과 되돌리기의 상태가 일치한다", () => {
  const { registry, service } = session();
  assert.equal(registry.get("job").editor.document.elements.length, 1);
  const updated = service.applyCommands("job", [{type:"set_aspect_ratio",aspectRatio:"9:16"}], 0);
  assert.equal(updated.aspectRatio, "9:16");
  assert.equal(updated.editor.document.aspectRatio, "9:16");
  assert.throws(() => service.applyCommands("job", [], 0), /변경되었습니다/);
  const undo = service.undo("job", 1);
  assert.equal(undo.aspectRatio, "4:5");
  assert.equal(undo.editor.document.aspectRatio, "4:5");
});

test("잘못된 명령 묶음이나 없는 이미지는 문서를 부분적으로 변경하지 않는다", () => {
  const { registry, service } = session();
  const before = registry.get("job");
  const image = makeElementDefinition({id:"image",kind:"image"});
  assert.throws(() => service.applyCommands("job", [
    {type:"add_element",element:image},
    {type:"place_element",slideId:"slide-1",elementId:"image",placementId:"image-1"},
    {type:"set_slot_value",slideId:"slide-1",placementId:"image-1",value:"missing"},
  ], 0), /이미지를 찾을 수 없습니다/);
  assert.deepEqual(registry.get("job"), before);
  assert.throws(() => service.applyCommands("job", [{type:"set_aspect_ratio",aspectRatio:"invalid"}], 0));
  assert.deepEqual(registry.get("job"), before);
  assert.equal(registry.getRecord("job").editorHistory.length, 0);
});
