import test from "node:test";
import assert from "node:assert/strict";
import { stageContext } from "./context";
import type { WorkDetail } from "../../../domain/contracts";

test("repair nodes receive the decision, image plan, source and unresolved issues without candidate history", () => {
  for (const step of ["production", "hook", "polish", "visual"] as const) {
    const detail = {task:{current_step:step}, analysis:{answer:"Approved answer", sources:[{clone_project_id:"source"}], reasoning:"candidate-history"},
      production:{slide_plan:[{visual:"Machine image"}],content_review:{issues:[{issue:"Wrong image"}]}, remaining_actions:["Replace image"]},
      log:{content_summary:{slides:[]}},analysis_inputs:[{id:"candidate"}]} as unknown as WorkDetail;
    const visible=stageContext(detail);
    assert.equal(visible.analysis.answer,"Approved answer");
    assert.deepEqual(visible.analysis.sources,detail.analysis.sources);
    assert.deepEqual(visible.production?.slide_plan,detail.production?.slide_plan);
    assert.deepEqual(visible.production?.content_review,detail.production?.content_review);
    assert.equal(visible.analysis.reasoning,undefined);
    assert.deepEqual(visible.analysis_inputs,[]);
  }
});
