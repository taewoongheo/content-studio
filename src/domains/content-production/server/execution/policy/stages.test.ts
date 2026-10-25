import test from "node:test";
import assert from "node:assert/strict";
import { stagePolicy } from "./stages";

test("stage tools, native web and shell follow the same explicit capability policy", () => {
  for (const step of ["analysis","production","hook","visual","polish"] as const) {
    const policy=stagePolicy(step);
    assert.equal(policy.imageGeneration,step === "production");
    assert.equal(policy.tools.has("production_use_generated_image"),step === "production");
    assert.equal(policy.tools.has("production_import_image"),false);
    assert.equal(policy.webSearch,step === "production" || step === "hook");
    assert.equal(policy.shell,policy.webSearch);
    assert.equal(policy.tools.has("production_create_project"),step === "production");
    assert.equal(policy.tools.has("production_change_direction"),step === "production");
    assert.equal(policy.tools.has("production_visual_references"),step === "visual");
    assert.equal(policy.tools.has("production_external_references"),step !== "visual" && step !== "polish");
    assert.equal(policy.tools.has("edit_project"),step !== "analysis");
  }
});
