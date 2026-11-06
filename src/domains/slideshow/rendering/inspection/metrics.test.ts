import test from "node:test";
import assert from "node:assert/strict";
import { alphaBounds, visibleGap } from "./metrics";
test("transparent margins and faint fringe do not become visible spacing bounds",()=>{
  const data=new Uint8ClampedArray(10*8*4);
  data[3]=8;
  for(let y=2;y<=4;y++)for(let x=3;x<=6;x++)data[(y*10+x)*4+3]=255;
  assert.deepEqual(alphaBounds(data,10,8),{x:3,y:2,width:4,height:3});
  assert.equal(alphaBounds(new Uint8ClampedArray(320),10,8),null);
  assert.equal(visibleGap({x:3,y:2,width:4,height:3},{x:3,y:15,width:4,height:3},"y"),10);
});
