import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  productionStore,
  startProduction,
  execute,
  stopProduction,
  recordReview,
} from "./runner";
import { createTaskProject } from "../projects";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import type { runCodex } from "./process";
const direction = {
  analysis: "Observed",
  topic: "arms",
  content_type: "routine",
  message: "train",
  answer: "3 sets",
  presentation: "cards",
  reason: "useful",
  expected_response: "save",
  goal_connection: "install",
  difference_from_recent: "new",
  sources_json: "[]",
};
test("실행기는 분석 저장 후에만 제작하며 이미지 검토·취소 후 쓰기를 검증한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "production-runner-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(dir, "test.sqlite");
  const store = productionStore();
  try {
    const [id] = store.create(1);
    const previousToken = process.env.APIFY_API_TOKEN;
    try {
      process.env.APIFY_API_TOKEN = "test-key";
      await assert.rejects(startProduction(1, "http://127.0.0.1:3000"), /남은 제작/);
      assert.equal(store.list().length, 1);
    } finally {
      if (previousToken === undefined) delete process.env.APIFY_API_TOKEN;
      else process.env.APIFY_API_TOKEN = previousToken;
    }
    let calls = 0;
    const executor: typeof runCodex = async () => {
      calls++;
      if (calls === 1) {
        assert.equal(store.get(id).task.current_step, "analysis");
        return direction;
      }
      assert.equal(store.get(id).analysis.state, "completed");
      const { projectId } = createTaskProject(store, id, 1),
        job = contentJobRegistry.get(projectId);
      new SlideshowProjectWrites(contentJobRegistry, store.db).edit(
        projectId,
        [
          {
            type: "add_element",
            element: makeElementDefinition({ id: "title", kind: "text" }),
          },
          {
            type: "place_element",
            slideId: "slide-1",
            elementId: "title",
            placementId: "title-placement",
          },
          {
            type: "set_slot_value",
            slideId: "slide-1",
            placementId: "title-placement",
            value: "3 SETS TO START",
          },
        ],
        job.editor.revision,
        job.tabId,
      );
      const final = contentJobRegistry.get(projectId);
      recordReview(
        id,
        projectId,
        final.editor.revision,
        final.editor.document.slides.map((s) => s.id),
      );
      return {
        project_id: projectId,
        summary_json: '{"hook":"test"}',
        sources_json: "[]",
        reviewed_slide_ids: job.editor.document.slides.map((s) => s.id),
        reviewed_revision: final.editor.revision,
      };
    };
    await execute(id, "http://127.0.0.1:3000", executor);
    assert.equal(calls, 2);
    assert.equal(store.get(id).task.state, "finished");
    const [canceled] = store.create(1);
    let unblock!: (value: Record<string, unknown>) => void;
    const execution = execute(
      canceled,
      "http://127.0.0.1:3000",
      () =>
        new Promise((resolve) => {
          unblock = resolve;
        }),
    );
    stopProduction(canceled, true);
    unblock(direction);
    await execution;
    assert.throws(() => store.get(canceled), /취소/);
    const [invalid] = store.create(1);
    await execute(invalid, "http://127.0.0.1:3000", async () => ({
      bad: true,
    }));
    assert.equal(store.get(invalid).task.state, "failed");
  } finally {
    store.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});


test("Apify 미연결이면 작업 생성 전에 시작을 거절한다", async () => {
  const previous = process.env.APIFY_API_TOKEN;
  try {
    delete process.env.APIFY_API_TOKEN;
    await assert.rejects(startProduction(1, "http://127.0.0.1:3000"), /Apify에 연결되지 않아/);
    process.env.APIFY_API_TOKEN = "   ";
    await assert.rejects(startProduction(1, "http://127.0.0.1:3000"), /Apify에 연결되지 않아/);
  } finally {
    if (previous === undefined) delete process.env.APIFY_API_TOKEN;
    else process.env.APIFY_API_TOKEN = previous;
  }
});
