import { cloneTaskProject } from "../projects/layout";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { createBlankDocument } from "@/domains/slideshow/editor/document";
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
  validateProductionCompletion,
  startProduction,
  execute,
  stopProduction,
  recordReview,
  recordLayoutReview,
  recordSourceReview,
  recordAnalysisRead,
} from "./runner";
import { deleteTaskProject } from "../projects";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import type { runCodex } from "./process";
const direction = {
  analysis: "Observed",
  readiness: { ready: true, reason: "All source roles mapped" }, reasoning: { observations: [], interpretations: [], candidates: [] },
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
    const projects = new ContentProjectStore(store.db);
    const saved = projects.get(source.project_id)!;
    const sourceDocument = createBlankDocument({ slideCount: 1, aspectRatio: "4:5", structure: "sequential" });
    sourceDocument.elements.push(makeElementDefinition({ id: "title", kind: "text" }));
    sourceDocument.slides[0].placements.push({ id: "title-placement", elementId: "title", value: "", frameOverride: null, styleOverride: null });
    projects.save({ ...saved, document: sourceDocument });
    const [id] = store.create(1,[source]);
    const previousToken = process.env.APIFY_API_TOKEN;
    try {
      process.env.APIFY_API_TOKEN = "test-key";
      const added = await startProduction(1, "http://127.0.0.1:3000", {
        refreshSpy: async () => ({}) as never,
        prepareTopics: async () => ({assignments:[],history:[]}),
        execute: async () => {},
      });
      assert.equal(store.list().length, 2, "existing drafts allow additional production requests");
      stopProduction(added[0], true);
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
        recordAnalysisRead(id,[source.id]);
        recordSourceReview(id, source.project_id);
        return {...direction,sources:[...direction.sources,{kind:"log",id:source.id,clone_project_id:source.project_id,part:"Layout",used_for:"Clone"}]};
      }
      assert.equal(store.get(id).analysis.state, "completed");
      const step = store.get(id).task.current_step;
      const { projectId } = step === "production" ? cloneTaskProject(store, id, source.project_id, "Preserve the source") : { projectId: store.get(id).task.project_id! };
      const job = contentJobRegistry.get(projectId);
      if (step === "hook" || step === "visual" || step === "polish") {
        if (step === "visual") {
          recordReview(id, projectId, job.editor.revision, job.editor.document.slides.map(s => s.id));
          recordLayoutReview(id, projectId, job.editor.revision, job.editor.document.slides.map(s => ({slideId:s.id,width:1080,height:1350,elements:[]})));
        }
        const result = { project_id: projectId, summary: { topic: direction.topic, message: direction.message, content_type: direction.content_type, hook: "test" }, sources: [],
          review: "The current content meets the review criteria.", review_passed: true,
          ...(step === "visual" ? {layout_checks: [], reviewed_slide_ids: job.editor.document.slides.map(s => s.id), reviewed_revision: job.editor.revision} : {}) };
        const document = contentJobRegistry.getRecord(projectId).editor.document;
        document.slides.push({ ...structuredClone(document.slides[0]), id: "extra-explanation" });
        await assert.rejects(validateProductionCompletion(id, result), { code: "SOURCE_FORMAT_MISMATCH" });
        document.slides.pop();
        return result;
      }
      const candidate = {
        project_id: projectId,
        slide_plan: job.editor.document.slides.map(slide => ({ slide_id: slide.id, role: slide.role, purpose: "Prescription", copy: ["3 SETS TO START"], visual: "Exercise" })),
        content_review: { assessment: "Reviewed", issues: [] },
        summary: { topic: direction.topic, message: direction.message, content_type: direction.content_type, hook: "test" }, sources: [],
      };
      const beforeValidation = store.get(id);
      await assert.rejects(validateProductionCompletion(id, candidate), { code: "EMPTY_SLIDE" });
      assert.deepEqual(store.get(id), beforeValidation);
      new SlideshowProjectWrites(contentJobRegistry, store.db).edit(
        projectId,
        [
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
      assert.equal((await validateProductionCompletion(id, candidate)).passed, true);
      assert.equal(store.get(id).task.current_step, "production");
      assert.equal(store.get(id).task.state, "running");
      const final = contentJobRegistry.get(projectId);
      return {
        project_id: projectId,
        slide_plan: final.editor.document.slides.map(slide => ({ slide_id: slide.id, role: slide.role, purpose: "Give a starting prescription", copy: ["3 SETS TO START"], visual: "Demonstrate the exercise" })),
        content_review: { assessment: "The prescription is supported and the hook matches the body.", issues: [] },
        summary: { topic: direction.topic, message: direction.message, content_type: direction.content_type, hook: "test" },
        sources: [],
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
    const savedPlanning = store.get(id).production!;
    for (const wrongProject of [true, false]) {
      store.db.prepare("UPDATE content_drafts SET current_step='production',state='stopped' WHERE id=?").run(id);
      await execute(id, "http://127.0.0.1:3000", async () => ({
        project_id: wrongProject ? "wrong-project" : projectId,
        slide_plan: [{ slide_id: "stale-slide", role: "hook", purpose: "Invalid", copy: ["Invalid"], visual: "Invalid" }],
        content_review: { assessment: "Invalid replacement", issues: [] },
        summary: { topic: direction.topic, message: direction.message, content_type: direction.content_type }, sources: [],
      }));
      assert.equal(store.get(id).task.state, "failed");
      assert.deepEqual(store.get(id).production?.slide_plan, savedPlanning.slide_plan);
      assert.deepEqual(store.get(id).production?.content_review, savedPlanning.content_review);
    }
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
      recordLayoutReview(id, projectId, job.editor.revision, job.editor.document.slides.map(s => ({slideId:s.id,width:1080,height:1350,elements:[]})));
      return { project_id: projectId, summary: { topic: direction.topic, message: direction.message, content_type: direction.content_type, hook: "test" }, sources: [],
        review: "The layout appears readable.", review_passed: true,
        layout_checks: [], reviewed_slide_ids: job.editor.document.slides.map(s => s.id), reviewed_revision: job.editor.revision };
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
    let signalStarted!: () => void;
    const started = new Promise<void>(resolve => { signalStarted = resolve; });
    let unblock!: (value: Record<string, unknown>) => void;
    const execution = execute(
      canceled,
      "http://127.0.0.1:3000",
      () =>
        new Promise((resolve) => {
          unblock = resolve; signalStarted();
        }),
    );
    await started;
    stopProduction(canceled, true);
    unblock(direction);
    await execution;
    assert.throws(() => store.get(canceled), /취소/);
    const [withoutComparison] = store.create(1,[]);
    await execute(withoutComparison, "http://127.0.0.1:3000", async () => direction);
    assert.equal(store.get(withoutComparison).task.state, "failed");
    assert.match(String((store.get(withoutComparison).analysis.error as { message: string }).message), /복제할 내부 게시글/);
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
