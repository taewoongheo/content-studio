import test from "node:test";
import assert from "node:assert/strict";
import { ApifyTikTokClient, parseApifyItem, normalizeTikTokUrl } from "./client";
test("Apify 공개 URL 수집은 계정 쿠키 없이 실행하고 수치·게시 시각을 보존한다",async()=>{
 let called=false;
 const transport:typeof fetch=async(_url,options)=>{
  called=true;const body=JSON.parse(String(options?.body));assert.deepEqual(body.postURLs,["https://www.tiktok.com/@test/photo/123"]);
  const headers=options?.headers as Record<string,string>;assert.equal(headers.Cookie,undefined);assert.equal(headers.Authorization,"Bearer test-key");
  return Response.json([{id:"123",createTime:1700000000,playCount:0,diggCount:4,slideshowImageLinks:["https://p.tiktokcdn.com/1.jpg","https://p.tiktokcdn.com/2.jpg"]}]);
 };
 const [post]=await new ApifyTikTokClient("test-key",transport).posts(["https://www.tiktok.com/@test/photo/123?q=tracking"]);
 assert.ok(called);assert.equal(post.view_count,0);assert.equal(post.save_count,null);assert.equal(post.images.length,2);assert.equal(post.published_at,"2023-11-14T22:13:20.000Z");
 assert.throws(()=>normalizeTikTokUrl("http://localhost/foo"));
});
test("키·게시물·실제 게시 시각이 없으면 수집 완료를 조작하지 않는다",async()=>{
 await assert.rejects(()=>new ApifyTikTokClient("").posts(["https://www.tiktok.com/@test/photo/123"]),/APIFY/);
 assert.equal(parseApifyItem({id:"123"}).published_at,null);
 await assert.rejects(()=>new ApifyTikTokClient("key",async()=>Response.json([])).posts(["https://www.tiktok.com/@test/photo/123"]),/조회하지 못/);
});
