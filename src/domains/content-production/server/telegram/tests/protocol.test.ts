import test from "node:test";
import assert from "node:assert/strict";
import { authorized, command, createRequest } from "../protocol";
const url="https://www.tiktok.com/@user/photo/12345";
test("create uses one additional-request field, with optional source URL",()=> {
  assert.deepEqual(createRequest("",()=>undefined),{mode:"automatic",instructions:""});
  assert.deepEqual(createRequest("등 운동 루틴\n덤벨만 사용",()=>undefined),{mode:"automatic",instructions:"등 운동 루틴\n덤벨만 사용"});
  assert.deepEqual(createRequest(`${url}?x=1 초보자용으로`,()=>undefined),{mode:"external_url",url,instructions:"초보자용으로"});
  assert.deepEqual(createRequest(`${url} 초보자용으로`,()=>({mode:"past_post",sourceProjectId:"p",instructions:""})),{mode:"past_post",sourceProjectId:"p",instructions:"초보자용으로"});
  assert.deepEqual(createRequest(url,()=>({mode:"spy_reference",referenceId:"r",instructions:""})),{mode:"spy_reference",referenceId:"r",instructions:""});
  assert.throws(()=>createRequest("https://example.com",()=>undefined));
  assert.deepEqual(command("/posts@mybot 등 운동"),{name:"posts",args:"등 운동"});
});
test("only configured user's private messages and callbacks are authorized",()=> {
  const message={text:"/create",from:{id:1},chat:{id:1,type:"private"}};
  assert.ok(authorized({update_id:1,message},"1"));
  assert.ok(!authorized({update_id:1,message},"2"));
  assert.ok(!authorized({update_id:1,message:{...message,chat:{id:1,type:"group"}}},"1"));
  assert.ok(authorized({update_id:1,callback_query:{id:"c",from:{id:1},message:{chat:message.chat}}},"1"));
});
