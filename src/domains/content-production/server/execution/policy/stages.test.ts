import test from "node:test";
import assert from "node:assert/strict";
import { stagePolicy } from "./stages";

test("all nodes can repair copy, geometry, assets and inspect their saved result", () => {
  for (const mode of ["automatic", "past_post", "external_url", "spy_reference"] as const) {
    for (const step of ["analysis", "production", "hook", "polish", "visual"] as const) {
      const policy = stagePolicy(step, mode);
      for (const tool of ["edit_project", "undo_project", "preview_slide", "preview_slides",
        "production_use_generated_image", "production_repair_badge", "production_read_project", "production_preview_project"])
        assert.ok(policy.tools.has(tool), `${step}: ${tool}`);
      assert.ok(policy.imageGeneration && policy.webSearch && policy.shell);
      assert.equal(policy.externalCollection, false);
      assert.equal(policy.tools.has("production_external_references"), mode === "external_url" || mode === "spy_reference");
      assert.equal(policy.tools.has("production_comparisons"), mode === "automatic");
      assert.equal(policy.tools.has("production_change_direction"), mode === "automatic" && ["analysis", "production"].includes(step));
      assert.equal(policy.tools.has("create_project"), false);
    }
  }
});
