import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_REFERENCE_IMAGE_BYTES,
  MAX_REFERENCE_IMAGES,
  validateReference,
  validateReferenceImages,
} from "./validation";

test("requires ordered reference images for the selected structure", () => {
  assert.match(validateReference([], "repeating"), /순서대로 추가/);
  assert.match(validateReference([{} as File], "sequential"), /최소 2장/);
  assert.equal(validateReference(Array(2).fill({} as File), "sequential"), "");
});

test("반복형은 실제 본문 장을 포함해야 한다", () => {
  assert.match(validateReference(Array(2).fill({} as File), "repeating"), /최소 3장/);
  assert.equal(validateReference(Array(4).fill({} as File), "repeating"), "");
});

test("accepts supported images up to the count and size limits", () => {
  assert.equal(
    validateReferenceImages(MAX_REFERENCE_IMAGES - 1, [
      { type: "image/png", size: MAX_REFERENCE_IMAGE_BYTES },
    ]),
    "",
  );
  assert.match(
    validateReferenceImages(MAX_REFERENCE_IMAGES, [
      { type: "image/png", size: 1 },
    ]),
    /최대/,
  );
  assert.match(
    validateReferenceImages(0, [{ type: "text/plain", size: 1 }]),
    /PNG/,
  );
});
