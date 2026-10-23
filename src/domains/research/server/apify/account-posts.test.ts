import test from "node:test";
import assert from "node:assert/strict";
import { ApifyAccountPostsClient, parseAccountPhotos } from "./account-posts";
const photo={id:"123",webVideoUrl:"https://www.tiktok.com/@test/video/123",slideshowImageLinks:["https://p.tiktokcdn.com/1.jpg","https://p.tiktokcdn.com/2.jpg"],playCount:100,diggCount:5,commentCount:1,collectCount:4};
test("designated account collection uses the same key and limits latest profile candidates to twelve",async()=>{
 const client=new ApifyAccountPostsClient("same-key",async(url,options)=>{
  assert.match(String(url),/clockworks~tiktok-scraper/);assert.match(String(url),/maxTotalChargeUsd=0.5/);
  assert.equal((options?.headers as Record<string,string>).Authorization,"Bearer same-key");
  const input=JSON.parse(String(options?.body));assert.deepEqual(input.profiles,["test"]);assert.equal(input.resultsPerPage,12);assert.equal(input.profileSorting,"latest");assert.equal(input.shouldDownloadVideos,false);
  return Response.json([photo]);
 });
 const [post]=await client.posts("test");assert.equal(post.engagement_rate,.1);assert.equal(post.share_count,null);assert.match(post.url,/\/photo\//);
 await assert.rejects(()=>new ApifyAccountPostsClient("").posts("test"),/APIFY/);
 await assert.rejects(()=>new ApifyAccountPostsClient("key",async()=>new Response("failed",{status:403})).posts("test"),/403/);
});
test("wrong-author results are rejected; duplicates, videos and unsafe media are not accepted as slideshows",()=>{
 assert.throws(()=>parseAccountPhotos([{...photo,webVideoUrl:"https://www.tiktok.com/@other/photo/123"}],"test"),/작성자/);
 const posts=parseAccountPhotos([photo,photo,{...photo,id:"124",webVideoUrl:"https://www.tiktok.com/@test/photo/124",collectCount:null},{...photo,id:"125",slideshowImageLinks:[]},{...photo,id:"126",slideshowImageLinks:["https://localhost/a","https://localhost/b"]}],"test");
 assert.equal(posts.length,2);assert.equal(posts[1].engagement_rate,null);assert.equal(posts[1].save_count,null);
});
