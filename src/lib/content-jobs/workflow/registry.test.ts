import assert from "node:assert/strict";
import test from "node:test";
import { ContentJobRegistry } from "./registry";

const input = { structure: "sequential", aspectRatio: "4:5", slideCount: 2, outputLanguage: "English" } as const;

test("unsubscribing a listener without a close callback preserves a later close subscriber", () => {
  const registry = new ContentJobRegistry();
  const job = registry.add(input);
  const unsubscribe = registry.subscribe(job.id, () => {});
  let closed = false;
  registry.subscribe(job.id, () => {}, () => { closed = true; });
  unsubscribe();
  registry.remove(job.id);
  assert.equal(closed, true);
});

test("late unsubscribe from a closed tab cannot remove the reopened tab's listeners", () => {
  const registry = new ContentJobRegistry();
  const old = registry.add(input);
  const unsubscribe = registry.subscribe(old.id, () => {}, () => {});
  registry.remove(old.id);
  registry.add(input, old.id);
  let changes = 0;
  let closed = false;
  registry.subscribe(old.id, () => changes++, () => { closed = true; });
  unsubscribe();
  registry.update(old.id, job => { job.name = "Reopened"; });
  assert.equal(changes, 1);
  registry.remove(old.id);
  assert.equal(closed, true);
});
