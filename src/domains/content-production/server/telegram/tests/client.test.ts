import test from "node:test";
import assert from "node:assert/strict";
import { TelegramClient } from "../client";
test("image transport uses multipart albums and a single-photo fallback, preserving caption order",async()=>{
  const client=new TelegramClient("unused");
  const calls:Array<{method:string;form:FormData}>=[];
  client.upload=async<T>(method:string,form:FormData)=>{
    calls.push({method,form});
    return (method==="sendPhoto" ? {message_id:1} : [{message_id:2},{message_id:3}]) as T;
  };
  const photo={bytes:Buffer.from("png"),caption:"job 1 · 1/2"};
  assert.deepEqual(await client.photos("1",[photo]),[{message_id:1}]);
  assert.equal(calls[0].method,"sendPhoto");assert.equal(calls[0].form.get("photo"),"attach://photo0");
  assert.ok(calls[0].form.get("photo0") instanceof Blob);
  await client.photos("1",[photo,{...photo,caption:"job 1 · 2/2"}]);
  assert.equal(calls[1].method,"sendMediaGroup");
  const media=JSON.parse(String(calls[1].form.get("media")));
  assert.deepEqual(media.map((item:{caption:string})=>item.caption),["job 1 · 1/2","job 1 · 2/2"]);
});
