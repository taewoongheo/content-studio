import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { productionStore, execute, recordReview, recordSourceReview } from "../runner";
import { saveVisuals } from "../../publication/visuals";
import { createTaskProject } from "../../projects/creation";
import { cloneTaskProject } from "../../projects/layout";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import type { EditorCommand } from "@/domains/slideshow/editor/types";
import type { TopicAssignment } from "../../../domain/topics/model";

test("automatic spy origin reaches every stage using cached images, no internal clone and no Apify credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "automatic-spy-"));
  const previousPath = process.env.CONTENT_STUDIO_DB_PATH, previousToken = process.env.APIFY_API_TOKEN;
  process.env.CONTENT_STUDIO_DB_PATH = join(directory, "test.sqlite");
  delete process.env.APIFY_API_TOKEN;
  const store = productionStore(), attachments: string[] = [], stages: string[] = [];
  let projectId: string | undefined;
  try {
    const url = "https://www.tiktok.com/@example/photo/123";
    const setId = saveVisuals(store.db, { kind: "reference", url,
      slides: [0, 1].map(index => ({ data: Buffer.from(`cached-${index}`), width: 540, height: 675 })) });
    store.db.prepare("INSERT INTO content_reference_accounts(username,url,created_at) VALUES('example','https://www.tiktok.com/@example','now')").run();
    store.db.prepare(`INSERT INTO content_external_references(id,url,account,caption,observed_at,images_json,visual_set_id,created_at)
      VALUES('spy',?,'example','Original exercise cards','now','[]',?,'now')`).run(url, setId);
    const assignment: TopicAssignment = {
      candidate: { id: "candidate", topic: "Arms", reader_question: "Which exercises?", content_type: "Exercise cards", message: "Train arms", rationale: "Observed", reference_ids: ["spy"] },
      requested_lane: "exploration", selected_lane: "exploration", status: "untried", direct_log_ids: [], related_log_ids: [], evidence: "No own history", fallback: null,
    };
    const [id] = store.create(1, [], { assignments: [assignment], history: [] });
    const direction = { analysis: "Checked source", reasoning: { observations: [], interpretations: [], candidates: [] }, topic: "Arms",
      content_type: "Exercise cards", message: "Train arms", answer: "Exercise choices", presentation: "Preserve both source pages", reason: "Untried topic",
      expected_response: "Save", goal_connection: "Follow", difference_from_recent: "Untried", sources: [{ kind: "reference", id: "spy", visual_set_id: setId, part: "Both pages", used_for: "Format origin" }] };
    await execute(id, "http://127.0.0.1:3000", async input => {
      const step = store.get(id).task.current_step; stages.push(step);
      assert.ok(input.capabilities && "tools" in input.capabilities && input.capabilities.tools instanceof Set);
      assert.ok(input.capabilities.tools.has("production_create_project"));
      assert.equal(input.capabilities.tools.has("production_clone_project"), false);
      assert.equal(input.capabilities.tools.has("production_reference_images"), false);
      assert.equal(input.capabilities.tools.has("production_comparisons"), true);
      assert.match(input.prompt, /automatic origin=spy/);
      const paths = input.images!.slice(2); attachments.push(...paths);
      assert.equal(paths.length, ["production", "visual"].includes(step) ? 2 : 0);
      for (const [index, path] of paths.entries()) assert.equal(await readFile(path, "utf8"), `cached-${index}`);
      if (step === "analysis") { recordSourceReview(id, undefined, setId); return direction; }
      if (step === "production") {
        assert.throws(() => cloneTaskProject(store, id, "unrelated", "Wrong origin"), { code: "PROJECT_CREATION_MODE" });
        assert.throws(() => createTaskProject(store, id, 3), { code: "SOURCE_FORMAT_MISMATCH" });
        projectId = createTaskProject(store, id, 2).projectId;
        const project = contentJobRegistry.get(projectId);
        const commands: EditorCommand[] = [{ type: "add_element", element: makeElementDefinition({ id: "text", kind: "text" }) }];
        for (const slide of project.editor.document.slides) commands.push(
          { type: "place_element", slideId: slide.id, elementId: "text", placementId: "text" },
          { type: "set_slot_value", slideId: slide.id, placementId: "text", value: "Exercise choices" },
        );
        new SlideshowProjectWrites(contentJobRegistry, store.db).edit(projectId, commands, project.editor.revision, project.tabId);
      }
      const project = contentJobRegistry.get(projectId!);
      const result = { project_id: projectId!, summary: { topic: direction.topic, message: direction.message, content_type: direction.content_type, hook: "Exercise choices" }, sources: [] };
      if (step === "production") {
        const slide_plan = project.editor.document.slides.map(slide => ({ slide_id: slide.id, role: slide.role, purpose: "Corresponding source page", copy: ["Exercise choices"], visual: "Source composition" }));
        store.save(id, "production", { slide_plan });
        return { ...result, slide_plan, content_review: { assessment: "Matches source", issues: [] } };
      }
      if (step === "visual") recordReview(id, projectId!, project.editor.revision, project.editor.document.slides.map(slide => slide.id));
      return { ...result, review: "Source roles retained", review_passed: true,
        ...(step === "visual" ? { reviewed_revision: project.editor.revision, reviewed_slide_ids: project.editor.document.slides.map(slide => slide.id) } : {}) };
    });
    assert.deepEqual(stages, ["analysis", "production", "hook", "polish", "visual"]);
    assert.equal(store.get(id).task.state, "finished", JSON.stringify(store.get(id).production?.error));
    assert.equal(store.get(id).analysis.source_format, undefined, "external production must not require an internal snapshot");
    for (const path of attachments) await assert.rejects(access(path));
  } finally {
    if (projectId) contentJobRegistry.remove(projectId);
    store.db.close(); await rm(directory, { recursive: true, force: true });
    if (previousPath === undefined) delete process.env.CONTENT_STUDIO_DB_PATH; else process.env.CONTENT_STUDIO_DB_PATH = previousPath;
    if (previousToken === undefined) delete process.env.APIFY_API_TOKEN; else process.env.APIFY_API_TOKEN = previousToken;
  }
});
