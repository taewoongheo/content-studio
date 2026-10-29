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
