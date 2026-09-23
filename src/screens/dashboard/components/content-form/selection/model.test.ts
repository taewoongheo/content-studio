import assert from "node:assert/strict";
import test from "node:test";
import {
  contentTypes,
  creationMethods,
  isImplementedWorkflow,
} from "./model";

test("keeps slideshow and video as top-level content types", () => {
  assert.deepEqual(
    contentTypes.map((type) => type.id),
    ["slideshow", "video"],
  );
});

test("keeps all three creation methods while only enabling slideshow reference", () => {
  assert.deepEqual(
    creationMethods.map((method) => method.id),
    ["reference", "template", "scratch"],
  );
  assert.equal(isImplementedWorkflow("slideshow", "reference"), true);
  assert.equal(isImplementedWorkflow("slideshow", "template"), false);
  assert.equal(isImplementedWorkflow("video", "reference"), false);
});
