import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { readSampling,saveSampling } from "./sampling";
import { ProductionStore } from "../persistence/store";
test("sampling defaults persist and each run retains its own settings",()=>{
 const db=openLocalDatabase(":memory:");try {
  assert.deepEqual(readSampling(db),{internalCandidates:10,externalCandidates:10});
  saveSampling(db,{internalCandidates:20,externalCandidates:30});
  const store=new ProductionStore(db),[id]=store.create(1);
  saveSampling(db,{internalCandidates:50,externalCandidates:50});
  assert.deepEqual(store.get(id).external?.analysis?.sampling,{internalCandidates:20,externalCandidates:30});
  assert.throws(()=>saveSampling(db,{internalCandidates:4,externalCandidates:10}));
 }finally{db.close();}
});
