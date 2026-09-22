import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_REFERENCE_IMAGE_BYTES,
  MAX_REFERENCE_IMAGES,
  validateReference,
  validateReferenceImages,
} from "./validation";

test("requires at least one ordered reference image", () => {
  assert.match(validateReference([]), /순서대로 추가/);
  assert.equal(validateReference([{} as File]), "");
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
