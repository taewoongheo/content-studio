import { seedLayoutSource } from "../projects/testing/fixtures";
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
  recordSourceReview,
  recordExternalComparison,
  recordAnalysisRead,
} from "./runner";
import { cloneTaskProject, deleteTaskProject } from "../projects";
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
  sources: [{ kind: "url", id: null, url: "https://example.com", part: "Research summary", used_for: "Checked the prescription.", visual_set_id: null }],
};
test("실행기는 분석 저장 후에만 제작하며 이미지 검토·취소 후 쓰기를 검증한다", async () => {
  const dir = await mkdtemp(join(tmpdir(), "production-runner-"));
  process.env.CONTENT_STUDIO_DB_PATH = join(dir, "test.sqlite");
  const store = productionStore();
  try {
    const source = seedLayoutSource(store.db);
    const [id] = store.create(1,[source]);
    const previousToken = process.env.APIFY_API_TOKEN;
    try {
      process.env.APIFY_API_TOKEN = "test-key";
      await assert.rejects(startProduction(1, "http://127.0.0.1:3000"), /남은 draft/);
      assert.equal(store.list().length, 1);
    } finally {
      if (previousToken === undefined) delete process.env.APIFY_API_TOKEN;
      else process.env.APIFY_API_TOKEN = previousToken;
    }
    let calls = 0;
    const executor: typeof runCodex = async input => {
      assert.equal(input.model,"gpt-6.1-sol");
      calls++;
      if (calls === 1) {
        assert.equal(store.get(id).task.current_step, "analysis");
        recordExternalComparison(id);
        recordAnalysisRead(id,[source.id]);
        return direction;
      }
      assert.equal(store.get(id).analysis.state, "completed");
      const step = store.get(id).task.current_step;
      const { projectId } = step === "production" ? cloneTaskProject(store, id, source.project_id, "The saved routine layout fits this content.") : { projectId: store.get(id).task.project_id! };
      const job = contentJobRegistry.get(projectId);
      if (step === "hook" || step === "visual" || step === "polish") {
        if (step === "hook") recordSourceReview(id);
        recordReview(id, projectId, job.editor.revision, job.editor.document.slides.map(s => s.id));
        return { project_id: projectId, summary: { topic: direction.topic, message: direction.message, content_type: direction.content_type, hook: "test" }, sources: [],
          review: "The current content meets the review criteria.", review_passed: true,
          reviewed_slide_ids: job.editor.document.slides.map(s => s.id), reviewed_revision: job.editor.revision };
      }
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
        summary: { topic: direction.topic, message: direction.message, content_type: direction.content_type, hook: "test" },
        sources: [],
        reviewed_slide_ids: job.editor.document.slides.map((s) => s.id),
        reviewed_revision: final.editor.revision,
      };
    };
    await execute(id, "http://127.0.0.1:3000", executor);
    assert.equal(calls, 5);
    assert.equal(store.get(id).hook?.state, "completed");
    assert.equal(store.get(id).visual?.state, "completed");
    assert.equal(store.get(id).polish?.state, "completed");
    assert.equal(store.get(id).task.state, "finished");
    assert.equal(store.get(id).task.current_step, "visual");
    assert.equal((store.get(id).log.sources as Array<{ part: string }>)[0].part, "Research summary");
    const projectId = store.get(id).task.project_id!;
    // A quality rejection must preserve the reviewer’s actual reason in diagnostics.
    store.db.prepare("UPDATE content_drafts SET current_step='visual',state='stopped' WHERE id=?").run(id);
    const rejectedReview = "Confirmed clipping on slide-1 at the latest saved revision.";
    await execute(id, "http://127.0.0.1:3000", async () => ({
      review: rejectedReview, review_passed: false, sources: [],
    }));
    const rejected = store.get(id).visual?.error as { code: string; details: { review: string; review_passed: boolean } };
    assert.equal(rejected.code, "REVIEW_REJECTED");
    assert.equal(rejected.details.review, rejectedReview);
    assert.equal(rejected.details.review_passed, false);
    // Visual review must use only the current project; missing source previews do not block it.
    store.db.prepare("UPDATE content_drafts SET current_step='visual',state='stopped' WHERE id=?").run(id);
    await execute(id, "http://127.0.0.1:3000", async () => {
      const job = contentJobRegistry.get(projectId);
      recordReview(id, projectId, job.editor.revision, job.editor.document.slides.map(s => s.id));
      return { project_id: projectId, summary: { topic: direction.topic, message: direction.message, content_type: direction.content_type, hook: "test" }, sources: [],
        review: "The layout appears readable.", review_passed: true,
        reviewed_slide_ids: job.editor.document.slides.map(s => s.id), reviewed_revision: job.editor.revision };
    });
    assert.equal(store.get(id).task.state, "finished");
    store.state(id, "finished");
    store.db.prepare("INSERT INTO content_project_assets(project_id,asset_id,name,mime_type,byte_size,data) VALUES(?,?,?,?,?,?)")
      .run(projectId, "delete-test", "image", "image/png", 1, Buffer.from([1]));
    store.db.exec("CREATE TRIGGER fail_draft_removal BEFORE DELETE ON content_drafts BEGIN SELECT RAISE(ABORT, 'draft removal failed'); END;");
    assert.throws(() => deleteTaskProject(store, id), /draft removal failed/);
    assert.equal(contentJobRegistry.has(projectId), true, "failed deletion must restore the editor tab");
    assert.ok(store.db.prepare("SELECT id FROM content_projects WHERE id=?").get(projectId));
    assert.ok(store.db.prepare("SELECT asset_id FROM content_project_assets WHERE project_id=?").get(projectId));
    store.db.exec("DROP TRIGGER fail_draft_removal");
    deleteTaskProject(store, id);
    assert.equal(contentJobRegistry.has(projectId), false);
    assert.equal(store.db.prepare("SELECT id FROM content_projects WHERE id=?").get(projectId), undefined);
    assert.equal(store.db.prepare("SELECT asset_id FROM content_project_assets WHERE project_id=?").get(projectId), undefined);
    assert.equal(store.db.prepare("SELECT draft_id FROM content_analysis_drafts WHERE draft_id=?").get(id), undefined);
    assert.equal(store.db.prepare("SELECT draft_id FROM content_production_drafts WHERE draft_id=?").get(id), undefined);
    assert.throws(() => store.get(id), /취소/);
    const [canceled] = store.create(1);
    assert.throws(() => deleteTaskProject(store, canceled), /완성된 포스트/);
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
    const [withoutComparison] = store.create(1,[]);
    await execute(withoutComparison, "http://127.0.0.1:3000", async () => direction);
    assert.equal(store.get(withoutComparison).task.state, "failed");
    assert.match(String((store.get(withoutComparison).analysis.error as { message: string }).message), /外部|외부/);
    stopProduction(withoutComparison, true);
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
