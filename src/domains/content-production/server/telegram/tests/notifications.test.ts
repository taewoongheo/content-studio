import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../../persistence/store";
import { TelegramJobs } from "../commands/jobs";
import { TelegramStore } from "../store";
import { TelegramClient } from "../client";

test("an old notification cannot acknowledge a newly resumed job or restore reset jobs", async () => {
  const db = openLocalDatabase(":memory:");
  const store = new ProductionStore(db), state = new TelegramStore(db, "bot:1");
  const [id] = store.create(1);
  const client = new TelegramClient("unused");
  const jobs = new TelegramJobs(client, state, "1", "http://127.0.0.1:3000",
    { store: () => store, stop: () => {} }, { resume: async () => {}, reset: () => {} });
  try {
    store.state(id, "stopped");
    jobs.track(id);
    client.send = async () => { jobs.track(id); };
    await jobs.notify();
    assert.equal(state.get<Array<{notified:boolean}>>("jobs")![0].notified, false);
    client.send = async () => { state.set("jobs", []); };
    await jobs.notify();
    assert.deepEqual(state.get("jobs"), []);
  } finally { db.close(); }
});

test("failed notifications include the saved hook and slide copy",async()=>{
 const db=openLocalDatabase(":memory:"),store=new ProductionStore(db),state=new TelegramStore(db,"bot");
 try{
  const [id]=store.create(1);store.state(id,"failed");
  const logId=store.get(id).task.log_id;
  db.prepare("UPDATE content_creation_logs SET content_summary_json=? WHERE id=?").run(JSON.stringify({hook:"Saved hook",slides:[{copy:["Saved slide copy"]}]}),logId);
  const client=new TelegramClient("unused");let text="";client.send=async(_chat,message)=>{text=message;};
  const jobs=new TelegramJobs(client,state,"1","local",{store:()=>store,stop(){}},{resume:async()=>{},reset(){}});
  jobs.track(id);await jobs.notify();assert.match(text,/Saved hook/);assert.match(text,/Saved slide copy/);
 }finally{db.close();}
});
