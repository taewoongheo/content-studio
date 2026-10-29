import test from "node:test";
import assert from "node:assert/strict";
import { serializedCollection } from "./scheduler";
test("overlapping ticks are skipped and a failed call releases the memory guard", async () => {
  let release!:()=>void, calls=0, errors=0;
  const waiting = new Promise<void>(resolve => { release=resolve; });
  const tick = serializedCollection(async () => { calls++; await waiting; throw new Error("offline"); },() => { errors++; });
  const first = tick();
  await tick();
  assert.equal(calls,1);
  release(); await first;
  await tick();
  assert.equal(calls,2);
  assert.equal(errors,2);
});
