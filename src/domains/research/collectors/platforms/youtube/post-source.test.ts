import test from "node:test";
import assert from "node:assert/strict";
import {postChannel,originalYouTubeImage,discoverPostChannel} from "./post-source";
test("channel extraction selects the requested post and handles embedded JSON braces",()=>{
 const data={items:[{backstagePostRenderer:{postId:"other",authorEndpoint:{browseEndpoint:{browseId:"UCwrong"}}}},{backstagePostRenderer:{postId:"target",contentText:'quoted " } text',authorEndpoint:{browseEndpoint:{browseId:"UCcorrect"}}}}]};
 assert.equal(postChannel(`var ytInitialData = ${JSON.stringify(data)}; otherScript();`,"target"),"UCcorrect");
 assert.throws(()=>postChannel(`var ytInitialData = ${JSON.stringify(data)};`,"missing"),/채널/);
 assert.equal(originalYouTubeImage("https://yt3.ggpht.com/asset=s640-c-fcrop64=abc"),"https://yt3.ggpht.com/asset=s1600");
 assert.throws(()=>originalYouTubeImage("https://evil.test/asset"));
});
test("channel discovery uses a bounded canonical request and propagates cancellation",async()=>{
 const controller=new AbortController();
 await assert.rejects(()=>discoverPostChannel("id",controller.signal,async(url,init)=>{
   assert.equal(String(url),"https://www.youtube.com/post/id");assert.equal(init?.redirect,"error");
   controller.abort();return new Response("var ytInitialData = {};");
 }));
});
