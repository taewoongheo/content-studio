import assert from "node:assert/strict";
import test from "node:test";
import { ContentJobRegistry } from "../../workflow/registry";
import { EditorService } from "../service";
import { makeElementDefinition } from "../elements/factory";

function session() {
  const registry = new ContentJobRegistry({ createId: () => "job" });
  registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 6, outputLanguage: "English" });
  return { registry, service: new EditorService(registry) };
}

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
