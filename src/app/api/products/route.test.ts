import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POST, GET } from "./route";
import { getLocalDatabase } from "@/lib/local-db/database";
import { emptyProduct } from "@/domains/content-production/domain/product";

test("saving the product form immediately applies that product, while stale saves preserve the current selection", async () => {
  const directory = mkdtempSync(join(tmpdir(), "product-form-test-"));
  const previous = process.env.CONTENT_STUDIO_DB_PATH;
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  const request = (payload: unknown) => new Request("http://127.0.0.1:3000/api/products", {
    method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  try {
    const first = await POST(request({ action: "save", product: { ...emptyProduct, name: "첫 제품" } })).then(response => response.json());
    const second = await POST(request({ action: "save", product: { ...emptyProduct, name: "둘째 제품" } })).then(response => response.json());
    assert.equal(second.products.find((product: { active: boolean }) => product.active).id, second.id);
    const saved = await POST(request({ action: "save", id: first.id, revision: 1, product: { ...emptyProduct, name: "첫 제품 수정" } })).then(response => response.json());
    assert.equal(saved.products.find((product: { active: boolean }) => product.active).id, first.id);
    const stale = await POST(request({ action: "save", id: second.id, revision: 2, product: { ...emptyProduct, name: "저장되면 안 됨" } }));
    assert.equal(stale.status, 400);
    const state = await GET(new Request("http://127.0.0.1:3000/api/products", { headers: { host: "127.0.0.1:3000" } })).then(response => response.json());
    assert.equal(state.products.find((product: { active: boolean }) => product.active).id, first.id);
    assert.equal(state.products.length, 2);
  } finally {
    getLocalDatabase().close();
    if (previous === undefined) delete process.env.CONTENT_STUDIO_DB_PATH; else process.env.CONTENT_STUDIO_DB_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
});
