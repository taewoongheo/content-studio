import assert from "node:assert/strict";
import test from "node:test";
import { displayContent, displayContentKey } from "./display";

test("detail translation includes all prose and ignores technical state without mutating source",()=>{
  const context={topic:"Arms",analysis:"Long analysis",research:[{finding:"Question"}],
    content:{hook:"Build arms",slides:[{slide_id:"one",copy:["Use 3 sets"]}]},state:"running",updated_at:"now",error:{message:"Technical error"}};
  const before=structuredClone(context),projection=displayContent(context);
  assert.equal(projection.analysis,context.analysis);
  assert.deepEqual(projection.content,context.content);
  assert.equal(projection.state,undefined);assert.equal(projection.error,undefined);
  assert.equal(displayContentKey({...context,updated_at:"later",state:"completed"}),displayContentKey(context));
  assert.notEqual(displayContentKey({...context,analysis:"New analysis"}),displayContentKey(context));
  assert.deepEqual(context,before);
});
