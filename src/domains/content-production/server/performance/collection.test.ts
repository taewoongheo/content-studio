import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { collectPerformance, performanceStage } from "./collection";
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
