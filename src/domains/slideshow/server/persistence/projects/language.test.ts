import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "./store";

test("English 프로젝트의 실제 텍스트와 메타데이터를 DB 저장 전에 검사한다", () => {
  const db = openLocalDatabase(":memory:"), store = new ContentProjectStore(db);
  const document = { elements: [{ id: "body", kind: "text" }], slides: [{ id: "one", placements: [{ id: "copy", elementId: "body", value: "Train three times per week" }] }] };
  const input = { id: "project", name: "프로젝트 표시 이름", aspectRatio: "4:5", slideCount: 1, outputLanguage: "English", document, assets: [] };
  try {
    store.save(input);
    const before = store.get("project");
    assert.throws(() => store.save({ ...input, document: { ...document, slides: [{ id: "one", placements: [{ id: "copy", elementId: "body", value: "주 3회 운동" }] }] } }), /ENGLISH_REQUIRED/);
    assert.throws(() => store.updateMetadata("project", { topic: "등 운동", message: "선택 기준" }), /ENGLISH_REQUIRED/);
    assert.deepEqual(store.get("project"), before);
    store.updateMetadata("project", { topic: "Back training", message: "Train three times per week" });
  } finally { db.close(); }
});
