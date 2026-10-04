import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/lib/local-db/projects/store";
import { ContentJobRegistry } from "../../workflow/registry";
import { EditorService } from "../../editor/service";
import { saveContentProject } from "../service";
import { ProjectAutosave } from "./autosave";

function fixture() {
  const database = openLocalDatabase(":memory:");
  const stores = { projects: new ContentProjectStore(database) };
  const registry = new ContentJobRegistry();
  const job = registry.add({ structure: "sequential", aspectRatio: "4:5", slideCount: 2, outputLanguage: "English" });
  const editor = new EditorService(registry);
  const autosave = new ProjectAutosave(registry, () => database, () => stores);
  function edit(name: string) {
    const changed = editor.applyCommands(job.id, [{ type: "rename_slide", slideId: "slide-1", name }], registry.get(job.id).editor.revision);
    autosave.schedule(changed);
  }
  return { database, stores, registry, job, editor, autosave, edit };
}

test("첫 변경 후 5초에 최신 문서를 저장하고 계속된 편집도 저장 시점을 늦추지 않는다", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  try {
    f.edit("First");
    t.mock.timers.tick(4_000);
    f.edit("Latest");
    t.mock.timers.tick(999);
    assert.equal(f.stores.projects.get(f.job.id), null);
    t.mock.timers.tick(1);
    assert.deepEqual(f.stores.projects.get(f.job.id)?.document, f.registry.get(f.job.id).editor.document);
    assert.equal(f.registry.get(f.job.id).savedRevision, 2);
    f.edit("Next window");
    t.mock.timers.tick(5_000);
    assert.equal(f.registry.get(f.job.id).savedRevision, 3);
  } finally { f.autosave.cancel(f.job.id); f.database.close(); }
});

test("빈 탭·되돌린 임시 문서는 저장하지 않고 닫힌 탭의 예약도 취소한다", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  try {
    t.mock.timers.tick(5_000);
    assert.equal(f.stores.projects.get(f.job.id), null);
    f.edit("Draft");
    f.autosave.schedule(f.editor.undo(f.job.id, 1));
    t.mock.timers.tick(5_000);
    assert.equal(f.stores.projects.get(f.job.id), null);
    f.edit("Closed");
    f.registry.remove(f.job.id);
    t.mock.timers.tick(5_000);
    assert.equal(f.stores.projects.get(f.job.id), null);
  } finally { f.autosave.cancel(f.job.id); f.database.close(); }
});

test("수동·MCP 저장이 끝나면 예약 저장은 DB를 다시 쓰지 않는다", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  try {
    f.edit("Saved");
    saveContentProject(f.registry, f.job.id, "Saved", f.stores);
    f.database.exec("CREATE TRIGGER forbid_write BEFORE UPDATE ON content_projects BEGIN SELECT RAISE(ABORT, 'unexpected save'); END;");
    t.mock.timers.tick(5_000);
    assert.equal(f.registry.get(f.job.id).saveError, undefined);
    assert.equal(f.registry.get(f.job.id).savedRevision, 1);
  } finally { f.autosave.cancel(f.job.id); f.database.close(); }
});

test("저장 실패는 편집 내용을 유지하며 오류를 알리고 5초 뒤 최신 내용으로 재시도한다", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  try {
    f.database.exec("CREATE TRIGGER fail_save BEFORE INSERT ON content_projects BEGIN SELECT RAISE(ABORT, 'save failed'); END;");
    f.edit("Keep this");
    t.mock.timers.tick(5_000);
    assert.equal(f.stores.projects.get(f.job.id), null);
    assert.match(f.registry.get(f.job.id).saveError ?? "", /save failed/);
    f.database.exec("DROP TRIGGER fail_save");
    f.edit("Retry latest");
    t.mock.timers.tick(5_000);
    assert.equal(f.registry.get(f.job.id).savedRevision, 2);
    assert.equal(f.registry.get(f.job.id).saveError, undefined);
    assert.deepEqual(f.stores.projects.get(f.job.id)?.document, f.registry.get(f.job.id).editor.document);
  } finally { f.autosave.cancel(f.job.id); f.database.close(); }
});
