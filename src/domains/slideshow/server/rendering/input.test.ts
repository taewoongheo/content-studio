import assert from "node:assert/strict";
import test from "node:test";
import { ContentJobRegistry } from "@/domains/slideshow/workflow/registry";
import { EditorService } from "@/domains/slideshow/editor/service";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import { createEditorImage } from "@/domains/slideshow/editor/assets";
import { captureSlideshowRender } from "./input";

test("내보내기 캡처는 사용 이미지만 유지하고 탭 종료 뒤에도 같은 바이트를 제공한다", () => {
  const registry = new ContentJobRegistry();
  const job = registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 2, outputLanguage: "English" });
  const image = createEditorImage({ name: "image.png", type: "image/png", bytes: Buffer.from("snapshot bytes") });
  new EditorService(registry).applyCommands(job.id, [
    { type: "add_element", element: makeElementDefinition({ id: "image", kind: "image" }) },
    { type: "place_element", slideId: "slide-1", elementId: "image", placementId: "photo" },
    { type: "set_slot_value", slideId: "slide-1", placementId: "photo", value: image.id },
  ], 0, [image]);
  const empty = captureSlideshowRender(registry, job.id, ["slide-2"]); assert.deepEqual(empty.images(), {});
  const captured = captureSlideshowRender(registry, job.id); registry.remove(job.id);
  assert.equal(captured.images()[image.id], `data:image/png;base64,${Buffer.from("snapshot bytes").toString("base64")}`);
});
