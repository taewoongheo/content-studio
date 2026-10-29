import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../../persistence/store";
import { PRODUCTION_SCHEMA } from "../../persistence/schema";
import { draftId, draftNumber } from "../../persistence/draft-numbers";
import { TelegramStore } from "../store";
import { TelegramClient } from "../client";
import { TelegramHandler } from "../commands/handler";

test("draft numbers persist, survive completion, backfill old drafts and never reuse deleted numbers",()=> {
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db);
  try {
    const [a,b]=store.create(2);
    assert.equal(draftNumber(db,a),1);
    assert.equal(draftNumber(db,b),2);
    store.state(b,"finished");
    assert.equal(draftId(db,"2"),b);
    db.prepare("DELETE FROM content_drafts WHERE id=?").run(a);
    assert.throws(()=>draftId(db,"1"),/작업/);
    const [c]=store.create(1);
    assert.equal(draftNumber(db,c),3);
    // Simulate existing drafts before the numbering table was introduced.
    db.exec("DROP TRIGGER content_drafts_assign_number; DROP TABLE content_draft_numbers;");
    db.exec(PRODUCTION_SCHEMA);
    const original=draftNumber(db,c);
    db.exec(PRODUCTION_SCHEMA);
    assert.equal(draftNumber(db,c),original);
    assert.equal(draftId(db,String(original)),c);
    assert.throws(()=>draftId(db,c));
    assert.throws(()=>draftId(db,"1.2"));
  } finally {db.close();}
});

test("status is connection-only; job lists concise statuses and cancels only the matching draft",async()=> {
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"bot:1");
  const [a,b]=store.create(2),messages:string[]=[],stopped:string[]=[];
  const client=new TelegramClient("unused");
  client.send=async (_chat,text)=>{messages.push(text);};
  const handler=new TelegramHandler(client,state,"1","http://127.0.0.1:3000",{
    store:()=>store,start:async()=>[],stop:id=>{stopped.push(id);},
  });
  let update_id=0;
  const send=(text:string)=>handler.handle({update_id:update_id++,message:{text,from:{id:1},chat:{id:1,type:"private"}}});
  try {
    await send("/status");assert.equal(messages.at(-1),"서버 연결 정상.");
    await send("/job");assert.equal(messages.at(-1),"job 1 - 대기\njob 2 - 대기");
    assert.ok(!messages.at(-1)!.includes(a));
    await send("/job 2");assert.equal(messages.at(-1),"job 1 - 대기\njob 2 - 대기");
    await send("/stop 2");assert.deepEqual(stopped,[b]);
    await send("/stop 999");assert.deepEqual(stopped,[b]);
    assert.match(messages.at(-1)!,/찾을 수 없습니다/);
  } finally {db.close();}
});

test("resume accepts stopped/failed drafts only; reset clears tasks and pending selection",async()=> {
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"bot:1");
  const [id]=store.create(1),resumed:string[]=[],messages:string[]=[];
  const client=new TelegramClient("unused");client.send=async (_chat,text)=>{messages.push(text);};
  const handler=new TelegramHandler(client,state,"1","http://127.0.0.1:3000",{
    store:()=>store,start:async()=>[],stop:()=>{},
  },{resume:async task=>{resumed.push(task);store.state(task,"running");},reset:()=>{store.remove(id);}});
  let update_id=0;
  const send=(text:string)=>handler.handle({update_id:update_id++,message:{text,from:{id:1},chat:{id:1,type:"private"}}});
  try {
    await send("/resume 1");assert.equal(resumed.length,0);
    store.state(id,"stopped");
    await send("/resume 1");assert.deepEqual(resumed,[id]);
    await send("/resume 1");assert.equal(resumed.length,1);
    assert.equal((state.get<Array<{notified:boolean}>>("jobs"))![0].notified,false);
    state.set("pending",{id:"choice"});
    await send("/reset");assert.equal(store.list().length,0);
    assert.equal(state.get("pending"),null);assert.deepEqual(state.get("jobs"),[]);
    assert.match(messages.at(-1)!,/초기화했습니다/);
  } finally {db.close();}
});
