import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../../persistence/store";
import { TelegramStore } from "../store";
import { TelegramClient, type Buttons } from "../client";
import { TelegramHandler } from "../commands/handler";
import type { ProductionRequest } from "../../../domain/start/input";
class FakeClient extends TelegramClient {
  sent:Array<{text:string;buttons?:Buttons}>=[];
  constructor(){super("unused");}
  async send(_chat:string,text:string,buttons?:Buttons){this.sent.push({text,buttons});}
  async call<T>():Promise<T>{return true as T;}
}
test("selection, instructions, replay protection and terminal notifications use existing production services",async()=> {
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"bot:1"),client=new FakeClient();
  const requests:ProductionRequest[]=[];
  const handler=new TelegramHandler(client,state,"1","http://127.0.0.1:3000",{
    store:()=>store,start:async input=>{assert.ok(Array.isArray(input));requests.push(...input);return store.create(input);},stop:()=>{},
  });
  const chat={id:1,type:"private"};
  const message=(update_id:number,text:string)=>({update_id,message:{text,from:{id:1},chat}});
  try {
    await handler.handle({...message(1,"/create"),message:{text:"/create",from:{id:2},chat}});
    assert.equal(requests.length,0);
    const id=state.choice({mode:"automatic",instructions:""});
    await handler.handle({update_id:2,callback_query:{id:"cb",from:{id:1},message:{chat},data:`pick:${id}`}});
    await handler.handle(message(3,"덤벨만 사용해줘"));
    await new Promise(resolve=>setImmediate(resolve));
    await handler.handle(message(3,"덤벨만 사용해줘"));
    assert.deepEqual(requests,[{mode:"automatic",instructions:"덤벨만 사용해줘"}]);
    assert.equal(new TelegramStore(db,"bot:1").claim(3),false);
    const task=store.list()[0];
    store.state(task.id,"failed","Test failure");
    await handler.notify();
    const sent=client.sent.length;
    await handler.notify();
    assert.equal(client.sent.length,sent);
    assert.match(client.sent.at(-1)!.text,/Test failure/);
    await handler.handle({update_id:4,callback_query:{id:"old",from:{id:1},message:{chat},data:`go:${id}`}});
    assert.equal(requests.length,1);
  } finally {db.close();}
});

test("posts and refs search expose valid source choices and start the selected reference without instructions",async()=> {
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"bot:1"),client=new FakeClient();
  const requests:ProductionRequest[]=[];
  const handler=new TelegramHandler(client,state,"1","http://127.0.0.1:3000",{
    store:()=>store,start:async input=>{assert.ok(Array.isArray(input));requests.push(...input);return store.create(input);},stop:()=>{},
  });
  const chat={id:1,type:"private"};
  try {
    db.prepare("INSERT INTO content_projects(id,name,aspect_ratio,slide_count,output_language,document_json,created_at,updated_at) VALUES('p','등 운동','4:5',1,'English','{}','now','now')").run();
    db.prepare("INSERT INTO content_creation_logs(id,project_id,post_url,actual_published_at,created_at,updated_at) VALUES('l','p','https://www.tiktok.com/@user/photo/123','2026-10-01','now','now')").run();
    db.prepare("INSERT INTO content_reference_accounts(username,url,created_at) VALUES('spy','https://www.tiktok.com/@spy','now')").run();
    db.prepare("INSERT INTO content_external_references(id,url,account,caption,title,observed_at,images_json,created_at) VALUES('ref','https://www.tiktok.com/@spy/photo/456','spy','루틴','루틴','now','[]','now')").run();
    await handler.handle({update_id:1,message:{text:"/posts 등 운동",from:{id:1},chat}});
    assert.match(client.sent.at(-1)!.text,/등 운동/);
    assert.equal(state.readChoice(client.sent.at(-1)!.buttons![0][0].callback_data!.split(":")[1]).mode,"past_post");
    await handler.handle({update_id:2,message:{text:"/refs 루틴",from:{id:1},chat}});
    const choice=client.sent.at(-1)!.buttons![0][0].callback_data!;
    await handler.handle({update_id:3,callback_query:{id:"pick",from:{id:1},message:{chat},data:choice}});
    const go=client.sent.at(-1)!.buttons![0][0].callback_data!;
    await handler.handle({update_id:4,callback_query:{id:"go",from:{id:1},message:{chat},data:go}});
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(requests,[{mode:"spy_reference",referenceId:"ref",instructions:""}]);
  } finally {db.close();}
});

test("failed receipt and error responses can retry without losing source selection", async () => {
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"retry:1"),client=new FakeClient();
  let starts=0;
  const handler=new TelegramHandler(client,state,"1","http://127.0.0.1:3000",{
    store:()=>store,start:async input=>{starts++;assert.ok(Array.isArray(input));return store.create(input);},stop:()=>{},
  });
  const selected=state.choice({mode:"automatic",instructions:""});
  state.set("pending",{id:selected,request:{mode:"automatic",instructions:""}});
  const update={update_id:10,message:{text:"덤벨만",from:{id:1},chat:{id:1,type:"private"}}};
  const send=client.send.bind(client);
  try {
    client.send=async()=>{throw new Error("network");};
    await assert.rejects(handler.handle(update));
    assert.equal(state.get("offset"),undefined);
    assert.ok(state.get("pending"));assert.equal(starts,0);
    client.send=send;
    await handler.handle(update);
    await new Promise(resolve=>setImmediate(resolve));
    await handler.handle(update);
    assert.equal(starts,1);assert.equal(state.get("offset"),11);
  } finally {db.close();}
});

test("a stop is never replayed when its response and error response fail",async()=> {
  const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"stop:1"),client=new FakeClient();
  store.create(1);
  let stops=0;
  const handler=new TelegramHandler(client,state,"1","http://127.0.0.1:3000",{
    store:()=>store,start:async()=>[],stop:()=>{stops++;},
  });
  const update={update_id:1,message:{text:"/stop 1",from:{id:1},chat:{id:1,type:"private"}}};
  try {
    client.send=async()=>{throw new Error("network");};
    await assert.rejects(handler.handle(update));
    await handler.handle(update);
    assert.equal(stops,1);assert.equal(state.get("offset"),2);
  } finally {db.close();}
});
