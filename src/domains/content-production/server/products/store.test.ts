import assert from "node:assert/strict";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { emptyProduct } from "../../domain/product";
import { activeProduct, deleteProduct, listProducts, saveProduct, selectProduct } from "./store";
import { stagePrompt } from "../execution/prompts";

test("products have one active selection, guarded edits, and product identity replaces legacy brand inputs in every node", () => {
  const db = openLocalDatabase(":memory:");
  try {
    const first = saveProduct(db, { ...emptyProduct, name: "First product", cta: "Follow for updates" });
    const second = saveProduct(db, { ...emptyProduct, name: "Second product", features: "Verified feature" });
    assert.equal(activeProduct(db)?.id, first);
    selectProduct(db, second);
    assert.equal(listProducts(db).filter(product => product.active).length, 1);
    const selected = activeProduct(db)!;
    for (const stage of ["analysis", "production", "hook", "polish", "visual"] as const) {
      const prompt = stagePrompt("task", stage, [], null, selected);
      assert.match(prompt, /ONE Second product TikTok/);
      assert.match(prompt, /Verified feature/);
      assert.doesNotMatch(prompt, /Workspace guidance: liftcode.md/);
    }
    saveProduct(db, { ...emptyProduct, name: "Revised product" }, second, selected.revision);
    assert.throws(() => saveProduct(db, emptyProduct, second, selected.revision));
    assert.throws(() => deleteProduct(db, second, selected.revision), /변경/);
    assert.throws(() => selectProduct(db, "missing"), /찾을 수/);
    assert.equal(activeProduct(db)?.id, second);
    deleteProduct(db, second, selected.revision + 1);
    assert.equal(activeProduct(db), null);
    assert.equal(listProducts(db).length, 1);
    selectProduct(db, first);
    assert.equal(activeProduct(db)?.id, first);
  } finally { db.close(); }
});
