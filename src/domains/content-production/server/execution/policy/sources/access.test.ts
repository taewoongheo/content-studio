import test from "node:test";
import assert from "node:assert/strict";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ProductionStore } from "../../../persistence/store";
import { seedLayoutSource } from "../../../projects/testing/fixtures";
import { assertSourceProjectAccess } from "./access";

test("selected source outside the comparison pool is readable; visual lookup cannot expand it", () => {
  const db = openLocalDatabase(":memory:"), store = new ProductionStore(db);
  try {
    const selected = seedLayoutSource(db, "selected"), comparison = seedLayoutSource(db, "comparison");
    const [past, auto] = store.create([
      { mode: "past_post", sourceProjectId: selected.project_id, instructions: "" },
      { mode: "automatic", instructions: "" },
    ], [comparison]);
    for (const step of ["analysis", "production", "visual"] as const)
      assert.doesNotThrow(() => assertSourceProjectAccess(store, past, step, selected.project_id));
    assert.doesNotThrow(() => assertSourceProjectAccess(store, past, "analysis", comparison.project_id));
    assert.throws(() => assertSourceProjectAccess(store, past, "visual", comparison.project_id), { code: "VISUAL_SOURCE_NOT_SELECTED" });
    assert.throws(() => assertSourceProjectAccess(store, auto, "analysis", selected.project_id), { code: "ANALYSIS_SOURCE_NOT_ASSIGNED" });
  } finally { db.close(); }
});
