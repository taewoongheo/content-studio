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
    assert.equal(policy.webSearch,step === "production");
    assert.equal(policy.shell,policy.webSearch);
    assert.equal(policy.tools.has("production_create_project"),false);
    assert.equal(policy.tools.has("production_clone_project"),step === "production");
    assert.equal(policy.tools.has("production_change_direction"),step === "production");
    assert.equal(policy.tools.has("production_visual_references"),false);
    if(step === "visual") for(const tool of ["production_query","production_comparisons","production_read_project","production_preview_project","production_read_images"])
      assert.equal(policy.tools.has(tool),false,tool);
    assert.equal(policy.tools.has("production_external_references"),false);
    assert.equal(policy.tools.has("edit_project"),step !== "analysis");
  }
});

test("only past-post visual review may inspect the selected source", () => {
  assert.equal(stagePolicy("visual", "past_post").tools.has("production_preview_project"), true);
  assert.equal(stagePolicy("visual", "external_url").tools.has("production_preview_project"), false);
  assert.equal(stagePolicy("visual", "past_post").tools.has("production_external_references"), false);
});

test("explicit analysis reads only the selected external slides and never checks overlap",()=>{
  for(const mode of ["past_post","external_url","spy_reference"] as const){
    for(const step of ["analysis","production","hook","polish","visual"] as const){
      const policy=stagePolicy(step,mode);
      assert.equal(policy.tools.has("production_comparisons"),false);
      assert.equal(policy.tools.has("production_change_direction"),false);
      if(step === "hook") {
        assert.equal(policy.webSearch,false);assert.equal(policy.shell,false);
        assert.equal(policy.tools.has("production_external_references"),false);
      }
    }
    assert.equal(stagePolicy("analysis",mode).tools.has("production_read_images"),mode !== "past_post");
    assert.equal(stagePolicy("analysis",mode).tools.has("production_external_references"),false);
  }
});

test("only final visual verification can preview the current project",()=>{
  for(const mode of ["automatic","past_post","external_url","spy_reference"] as const)
    for(const step of ["analysis","production","hook","polish","visual"] as const){
      const tools=stagePolicy(step,mode).tools;
      assert.equal(tools.has("preview_slide"),step === "visual");
      assert.equal(tools.has("preview_slides"),step === "visual");
      if(step === "hook" || step === "polish") assert.equal(tools.has("production_preview_project"),false);
    }
});
