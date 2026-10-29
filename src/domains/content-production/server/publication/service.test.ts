import { listFormalContent } from "./list";
import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { finalizePublication } from "./service";
import { ProductionStore } from "../persistence/store";
import { parseApifyItem } from "@/domains/research/server/apify/client";
import { saveVisuals } from "./visuals";
test("시각 자료 묶음과 모든 장은 함께 저장되고 재시도는 중복 생성하지 않는다", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const input = {
      kind: "reference" as const,
      url: "https://www.tiktok.com/@a/photo/123",
      slides: [{ data: Buffer.from("image"), width: 540, height: 675 }],
    };
    const id = saveVisuals(db, input);
    assert.equal(saveVisuals(db, input), id);
    assert.equal(
      (
        db.prepare("SELECT COUNT(*) n FROM content_visual_slides").get() as {
          n: number;
        }
      ).n,
      1,
    );
    assert.throws(() =>
      saveVisuals(db, {
        ...input,
        url: "https://www.tiktok.com/@a/photo/456",
        slides: [],
      }),
    );
  } finally {
    db.close();
  }
});

test("게시 성공은 소유권만 이관하고 모든 draft를 지우며 문서·이미지·조사를 보존한다", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  try {
    db.prepare(`INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at)
      VALUES('project','Draft','4:5',1,'English','{}','now','now')`).run();
    db.prepare("INSERT INTO content_project_assets VALUES('project','image','Image','image/png',1,?)").run(Buffer.from([7]));
    const [id] = store.create(1), logId = store.get(id).task.log_id;
    db.prepare("UPDATE content_drafts SET project_id='project',state='finished' WHERE id=?").run(id);
    db.prepare("UPDATE content_analysis_drafts SET research_json=? WHERE draft_id=?").run('[{"finding":"evidence"}]',id);
    db.prepare("INSERT INTO content_production_drafts(draft_id,created_at,updated_at) VALUES(?,?,?)").run(id,"now","now");
    assert.equal(listFormalContent(db).length,0);
    assert.equal((db.prepare("SELECT project_id FROM content_creation_logs WHERE id=?").get(logId) as {project_id:null}).project_id,null);
    assert.equal(store.get(id).task.project_id,"project");
    const url = "https://www.tiktok.com/@a/photo/123";
    const post = parseApifyItem({id:"123",createTimeISO:"2026-10-23T01:00:00Z",playCount:42});
    assert.throws(() => finalizePublication(db,logId,url,post,[],id), /전체 슬라이드/);
    assert.equal(store.hasOpenDrafts(),true);
    assert.equal(listFormalContent(db).length,0);
    const slides = [{data:Buffer.from([1]),width:540,height:675}];
    db.exec("CREATE TRIGGER reject_publish BEFORE DELETE ON content_drafts BEGIN SELECT RAISE(ABORT, 'reject publish'); END");
    assert.throws(() => finalizePublication(db,logId,url,post,slides,id), /reject publish/);
    assert.equal(listFormalContent(db).length,0);
    assert.equal((db.prepare("SELECT count(*) n FROM content_visual_sets").get() as {n:number}).n,0);
    assert.equal(store.hasOpenDrafts(),true);
    db.exec("DROP TRIGGER reject_publish");
    finalizePublication(db,logId,url,post,slides,id);
    assert.equal(store.hasOpenDrafts(),false);
    assert.equal(listFormalContent(db).length,1);
    for (const table of ["content_drafts","content_analysis_drafts","content_production_drafts"])
      assert.equal((db.prepare("SELECT count(*) n FROM "+table).get() as {n:number}).n,0);
    const log = store.logs("",true)[0];
    assert.equal(log.project_id,"project");
    assert.equal(log.view_count,42);
    assert.match(JSON.stringify(log.content_summary),/evidence/);
    assert.deepEqual((db.prepare("SELECT data FROM content_project_assets").get() as {data:Buffer}).data,Buffer.from([7]));
    finalizePublication(db,logId,url,post,slides);
    assert.equal(store.logs("",true).length,1);
    assert.deepEqual(db.pragma("foreign_key_check"),[]);
  } finally {db.close();}
});

test("수집 중 삭제된 작업은 게시 처리로 되살아나지 않는다", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  try {
    const [id] = store.create(1), logId = store.get(id).task.log_id;
    store.remove(id);
    assert.throws(() => finalizePublication(db,logId,"https://www.tiktok.com/@a/photo/123",
      parseApifyItem({id:"123"}),[{data:Buffer.from([1]),width:1,height:1}],id),/삭제된 작업/);
    assert.equal(store.logs().length,0);
    assert.equal((db.prepare("SELECT count(*) n FROM content_visual_sets").get() as {n:number}).n,0);
  } finally {db.close();}
});

