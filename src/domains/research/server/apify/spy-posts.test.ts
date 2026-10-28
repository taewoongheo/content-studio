import test from "node:test";
import assert from "node:assert/strict";
import { ApifySpyClient } from "./spy-posts";
test("spy requests multiple profiles with one result each, retaining videos and non-English metadata",async()=>{
 const client=new ApifySpyClient('key',async(_url,options)=>{
  const input=JSON.parse(String(options?.body));
  assert.deepEqual(input.profiles,['a','b']);assert.equal(input.resultsPerPage,1);
  assert.equal(input.shouldDownloadSlideshowImages,false);assert.equal(input.shouldDownloadVideos,false);assert.equal(input.excludePinnedPosts,true);
  return Response.json([{id:'1',webVideoUrl:'https://www.tiktok.com/@a/video/1',isSlideshow:false,textLanguage:'ko',text:'등 운동'},
    {id:'2',webVideoUrl:'https://www.tiktok.com/@b/photo/2',slideshowImageLinks:['https://p.tiktokcdn.com/1','https://p.tiktokcdn.com/2']}]);
 });
 const result=await client.posts(['a','b'],1);assert.equal(result.get('a')?.[0].text,'등 운동');assert.equal(result.get('a')?.[0].view_count,null);assert.equal(result.get('b')?.[0].images.length,2);
});
test("malformed and wrong-account responses fail without silently advancing the scan",async()=>{
 for(const row of [{id:'1',webVideoUrl:'https://www.tiktok.com/@wrong/video/1'},{id:'1',webVideoUrl:'https://www.tiktok.com/@a/video/2'},{error:'unavailable'}]) {
  const client=new ApifySpyClient('key',async()=>Response.json([row]));
  await assert.rejects(()=>client.posts(['a'],1));
 }
});
