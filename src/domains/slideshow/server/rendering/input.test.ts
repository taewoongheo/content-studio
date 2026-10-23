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

test("저장본 캡처는 탭을 열지 않고 DB 문서·이미지를 사용하며 캐시 키에 문서 변경을 반영한다", async () => {
  const {openLocalDatabase} = await import("@/lib/local-db/database");
  const {ContentProjectStore} = await import("../persistence/projects/store");
  const {captureSavedSlideshowRender} = await import("./input");
  const db=openLocalDatabase(":memory:");
  try {
    const store=new ContentProjectStore(db), registry=new ContentJobRegistry();
    const job=registry.add({structure:"sequential",aspectRatio:"4:5",slideCount:1,outputLanguage:"English"});
    const image=createEditorImage({name:"asset.png",type:"image/png",bytes:Buffer.from("saved bytes")});
    new EditorService(registry).applyCommands(job.id,[
      {type:"add_element",element:makeElementDefinition({id:"image",kind:"image"})},
      {type:"place_element",slideId:"slide-1",elementId:"image",placementId:"photo"},
      {type:"set_slot_value",slideId:"slide-1",placementId:"photo",value:image.id},
    ],0,[image]);
    const doc=registry.get(job.id).editor.document;
    store.save({id:job.id,name:"Source",aspectRatio:"4:5",slideCount:1,outputLanguage:"English",document:doc,
      assets:[{assetId:image.id,name:image.name,type:image.type,bytes:Buffer.from(image.bytes)}]});
    registry.remove(job.id);
    const first=captureSavedSlideshowRender(store,job.id);
    assert.equal(registry.has(job.id),false);
    assert.equal(first.images()[image.id],"data:image/png;base64,"+Buffer.from("saved bytes").toString("base64"));
    db.prepare("UPDATE content_projects SET document_json=? WHERE id=?").run(JSON.stringify({...doc,slides:doc.slides.map(slide=>({...slide,backgroundColor:"#000000"}))}),job.id);
    const second=captureSavedSlideshowRender(store,job.id);
    assert.notEqual(first.job.tabId,second.job.tabId);
    assert.equal(first.job.editor.document.slides[0].backgroundColor,"#FFFFFF");
    assert.throws(()=>captureSavedSlideshowRender(store,job.id,["missing"]),/슬라이드/);
    assert.equal(registry.has(job.id),false);
  } finally {db.close();}
});
