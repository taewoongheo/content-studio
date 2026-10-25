import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "./store";

test("project output language is descriptive and does not reject saved copy or metadata", () => {
  const db = openLocalDatabase(":memory:"), store = new ContentProjectStore(db);
  const document = { elements: [{ id: "body", kind: "text" }], slides: [{ id: "one", placements: [{ id: "copy", elementId: "body", value: "Fixed bottom-left LIFTCODE badge" }] }] };
  const input = { id: "project", name: "프로젝트 표시 이름", aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document, assets: [] };
  try {
    store.save(input);
    const updated = {...document,slides:[{id:"one",placements:[{id:"copy",elementId:"body",value:"주 3회 운동"}]}]};
    store.save({...input,document:updated});
    assert.deepEqual(store.get("project")?.document,updated);
    store.updateMetadata("project",{topic:"등 운동",message:"선택 기준",content_type:"Comparison"});
    assert.equal(store.get("project")?.topic,"등 운동");
    assert.throws(()=>store.updateMetadata("project",{topic:"",message:"",content_type:""}));
  } finally { db.close(); }
});
