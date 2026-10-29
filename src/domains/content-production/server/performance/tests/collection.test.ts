import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { collectPerformance } from "../collection";
import { backfillPerformance } from "../store";
import { performanceStage } from "../../../domain/performance";
import { parseApifyItem } from "@/domains/research/server/apify/client";
const start = "2026-10-01T00:00:00Z", base = Date.parse(start);
test("elapsed boundaries select only the current stage", () => {
  for (const [hours,stage] of [[23,null],[24,"early"],[56,"early"],[72,"middle"],[100,"middle"],[168,"late"],[1000,"late"]] as const)
    assert.equal(performanceStage(start,base+hours*3600000),stage);
});
test("missed stages stay empty, successful stages survive restarts and failures retry", async () => {
  const db = openLocalDatabase(":memory:");
  try {
    db.prepare("INSERT INTO content_creation_logs(id,post_url,actual_published_at,created_at,updated_at) VALUES('l','https://www.tiktok.com/@a/photo/123',?,?,?)").run(start,start,start);
    let calls = 0;
    const client = {posts: async () => { calls++; return [parseApifyItem({id:"123",playCount:100,diggCount:0})]; }};
    await collectPerformance(db,client,base+100*3600000);
    await collectPerformance(db,client,base+101*3600000);
    assert.equal(calls,1);
    assert.deepEqual(db.prepare("SELECT stage,view_count,like_count,save_count FROM content_performance").all(),[{stage:"middle",view_count:100,like_count:0,save_count:null}]);
    const original = console.error; console.error = () => {};
    try { await collectPerformance(db,{posts:async()=>{throw new Error("offline");}},base+200*3600000); }
    finally { console.error = original; }
    assert.equal(db.prepare("SELECT * FROM content_performance").all().length,1);
    await collectPerformance(db,client,base+201*3600000);
    assert.equal(db.prepare("SELECT * FROM content_performance").all().length,2);
  } finally { db.close(); }
});

test("existing latest observations populate their measured stage without overwriting collected values", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const insert = db.prepare("INSERT INTO content_creation_logs(id,post_url,actual_published_at,observed_at,view_count,created_at,updated_at) VALUES(?,?,?,?,42,?,?)");
    for (const hours of [10,24,56,100,200]) insert.run(String(hours),`https://www.tiktok.com/@a/photo/${hours}`,start,new Date(base+hours*3600000).toISOString(),start,start);
    assert.equal(backfillPerformance(db),4);
    assert.deepEqual(db.prepare("SELECT log_id,stage FROM content_performance ORDER BY CAST(log_id AS INTEGER)").all(),[
      {log_id:"24",stage:"early"},{log_id:"56",stage:"early"},{log_id:"100",stage:"middle"},{log_id:"200",stage:"late"},
    ]);
    db.prepare("UPDATE content_creation_logs SET view_count=99 WHERE id='200'").run();
    assert.equal(backfillPerformance(db),0);
    assert.equal((db.prepare("SELECT view_count FROM content_performance WHERE log_id='200'").get() as {view_count:number}).view_count,42);
  } finally { db.close(); }
});
