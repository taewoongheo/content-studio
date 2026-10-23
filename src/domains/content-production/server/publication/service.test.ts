import { listFormalContent } from "./list";
import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { refreshMetrics, recentKoreanDate, finalizePublication } from "./service";
import { ProductionStore } from "../persistence/store";
import { ApifyTikTokClient, parseApifyItem } from "@/domains/research/server/apify/client";
import { saveVisuals } from "./visuals";
test("한국 날짜 수집 범위와 실패 시 기존 성과 보존", async () => {
  assert.equal(
    recentKoreanDate("2026-10-18T15:00:00Z", new Date("2026-10-22T02:00:00Z")),
    true,
  );
  assert.equal(
    recentKoreanDate("2026-10-18T14:59:00Z", new Date("2026-10-22T02:00:00Z")),
    false,
  );
  const db = openLocalDatabase(":memory:"),
    store = new ProductionStore(db);
  try {
    const [id] = store.create(1),
      log = store.get(id).task.log_id;
    db.prepare(
      "UPDATE content_creation_logs SET actual_published_at=?,post_url=?,view_count=42 WHERE id=?",
    ).run(new Date().toISOString(), "https://www.tiktok.com/@a/photo/123", log);
    const broken = new ApifyTikTokClient(
      "key",
      async () => new Response(null, { status: 503 }),
    );
    await assert.rejects(() => refreshMetrics(db, undefined, broken));
    assert.equal(store.get(id).log.view_count, 42);
    const valid = new ApifyTikTokClient("key", async () =>
      Response.json([{ id: "123", playCount: 80 }]),
    );
    await refreshMetrics(db, undefined, valid);
    assert.equal(store.get(id).log.view_count, 80);
    assert.equal(store.get(id).log.like_count, null);
  } finally {
    db.close();
  }
});
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

test("성과 갱신 스냅샷은 실제 대상·저장 수치를 표시하고 누락된 지표를 0으로 바꾸지 않는다", async () => {
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db);
  try {
    const [id]=store.create(1),logId=store.get(id).task.log_id;
    db.prepare("UPDATE content_creation_logs SET topic='Test post',post_url=?,actual_published_at=?,view_count=10 WHERE id=?")
      .run("https://www.tiktok.com/@a/photo/123",new Date().toISOString(),logId);
    const snapshots: Array<Array<{log_id:string;view_count:number|null;like_count:number|null}>>=[];
    const client=new ApifyTikTokClient("test-key",async()=>Response.json([{id:"123",playCount:99,diggCount:0}]));
    assert.equal(await refreshMetrics(db,undefined,client,rows=>snapshots.push(rows)),1);
    assert.equal(snapshots.length,2);
    assert.equal(snapshots[0][0].log_id,logId);
    assert.equal(snapshots[0][0].view_count,10);
    assert.equal(snapshots[1][0].view_count,99);
    assert.equal(snapshots[1][0].like_count,0);
    assert.equal(store.get(id).log.save_count,null);
  }finally{db.close();}
});
