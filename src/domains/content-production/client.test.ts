import test from "node:test";
import assert from "node:assert/strict";
import { requestDisplayTranslation, type TranslationField } from "./client";

test("stream client publishes early fields and rejects a stale field without replacing translated content", async()=>{
  const previous=globalThis.fetch;
  const encoder=new TextEncoder();
  let stream!:ReadableStreamDefaultController<Uint8Array>;
  globalThis.fetch=async()=>new Response(new ReadableStream({start(controller){stream=controller;}}));
  try {
    const seen:TranslationField[]=[];
    const pending=requestDisplayTranslation("task","analysis",JSON.stringify({message:"Train",analysis:"Long"}),undefined,event=>seen.push(event));
    await new Promise(resolve=>setImmediate(resolve));
    const data=encoder.encode(JSON.stringify({type:"field",field:"message",source:"Train",translated:"운동"})+"\n");
    stream.enqueue(data.slice(0,data.length-3));stream.enqueue(data.slice(data.length-3));
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(seen[0].translated,"운동","the first field must arrive before the full response ends");
    stream.enqueue(encoder.encode(JSON.stringify({type:"field",field:"analysis",source:"Changed",translated:"변경됨"})+"\n"));
    await assert.rejects(pending,/내용이 갱신/);
    assert.equal(seen.length,1);
  } finally {globalThis.fetch=previous;}
});
