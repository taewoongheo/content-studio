import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../../persistence/store";
import { saveVisuals } from "../../publication/visuals";
import { withReferenceImages } from "./attachments";
import type { ProductionInput } from "../../../domain/start/input";

test("external draft and visual get all preserved images in order; other nodes avoid attachment overhead", async () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  const signal = new AbortController().signal;
  const setId = saveVisuals(db,{kind:"reference",url:"https://example.com",slides:[0,1,2].map(index=>({data:Buffer.from(`slide-${index}`),width:540,height:675}))});
  try {
    for (const mode of ["external_url","spy_reference"] as const) {
      const input: ProductionInput = {request:mode === "external_url" ? {mode,url:"https://example.com",instructions:""} : {mode,referenceId:"source",instructions:""},source:{id:"source",visual_set_id:setId,slide_count:3}};
      for (const step of ["analysis","production","hook","polish","visual"] as const) {
        let captured: string[] = [];
        const result = await withReferenceImages(store,input,step,signal,async paths=>{
          captured = paths;
          assert.equal(paths.length,["production","visual"].includes(step) ? 3 : 0);
          for (const [index,path] of paths.entries()) assert.equal(await readFile(path,"utf8"),`slide-${index}`);
          return "result";
        });
        assert.equal(result,"result");
        for (const path of captured) await assert.rejects(access(path));
      }
    }
    await withReferenceImages(store,{request:{mode:"automatic",instructions:""}},"production",signal,async paths=>assert.deepEqual(paths,[]));
  } finally { db.close(); }
});

test("missing source slides prevent execution; errors and cancellation remove temporary images", async () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  const setId = saveVisuals(db,{kind:"reference",url:"https://example.com",slides:[{data:Buffer.from("slide"),width:540,height:675}]});
  const input: ProductionInput = {request:{mode:"external_url",url:"https://example.com",instructions:""},source:{id:"source",visual_set_id:setId,slide_count:1}};
  const controller = new AbortController();
  try {
    let captured: string[] = [];
    await assert.rejects(withReferenceImages(store,input,"visual",controller.signal,async paths=>{
      captured=paths; throw Error("executor failed");
    }), /executor failed/);
    for (const path of captured) await assert.rejects(access(path));
    await assert.rejects(withReferenceImages(store,input,"production",controller.signal,async paths=>{
      captured=paths; controller.abort(); controller.signal.throwIfAborted();
    }), {name:"AbortError"});
    for (const path of captured) await assert.rejects(access(path));
    db.prepare("DELETE FROM content_visual_slides WHERE set_id=?").run(setId);
    let called=false;
    await assert.rejects(withReferenceImages(store,input,"production",new AbortController().signal,async()=>{called=true;}), {code:"REFERENCE_IMAGES_INCOMPLETE"});
    assert.equal(called,false);
  } finally { db.close(); }
});
