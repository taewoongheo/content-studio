import test from "node:test";
import assert from "node:assert/strict";
import { stagePolicy } from "./stages";

test("stage tools, native web and shell follow the same explicit capability policy", () => {
  for (const step of ["analysis","production","hook","visual","polish"] as const) {
    const policy=stagePolicy(step);
    assert.equal(policy.tools.has("production_repair_badge"), step === "visual");
    assert.equal(policy.imageGeneration,step === "production");
    assert.equal(policy.tools.has("production_use_generated_image"),step === "production");
    assert.equal(policy.tools.has("production_import_image"),false);
    assert.equal(policy.webSearch,step === "production" || step === "hook");
    assert.equal(policy.shell,policy.webSearch);
    assert.equal(policy.tools.has("production_create_project"),step === "production");
    assert.equal(policy.tools.has("production_clone_project"),step === "production");
    assert.equal(policy.tools.has("production_change_direction"),step === "production");
    assert.equal(policy.tools.has("production_visual_references"),false);
    if(step === "visual") for(const tool of ["production_query","production_comparisons","production_read_project","production_preview_project","production_read_images"])
      assert.equal(policy.tools.has(tool),false,tool);
    assert.equal(policy.tools.has("production_external_references"),step !== "visual" && step !== "polish");
    assert.equal(policy.tools.has("edit_project"),step !== "analysis");
  }
});

test("only past-post visual review may inspect the selected source", () => {
  assert.equal(stagePolicy("visual", "past_post").tools.has("production_preview_project"), true);
  assert.equal(stagePolicy("visual", "external_url").tools.has("production_preview_project"), false);
  assert.equal(stagePolicy("visual", "past_post").tools.has("production_external_references"), false);
});
