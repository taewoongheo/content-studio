import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_REFERENCE_IMAGE_BYTES,
  MAX_REFERENCE_IMAGES,
  validateReference,
  validateReferenceImages,
  validateRepeatingReference,
} from "./validation";

test("requires at least one ordered reference image", () => {
  assert.match(validateReference([]), /순서대로 추가/);
  assert.equal(validateReference([{} as File]), "");
});

test("repeating references require one image for each role", () => {
  assert.match(
    validateRepeatingReference([{ role: "hook" }, { role: "body" }]),
    /CTA/,
  );
  assert.equal(
    validateRepeatingReference([
      { role: "hook" },
      { role: "body" },
      { role: "cta" },
    ]),
    "",
  );
  assert.match(
    validateRepeatingReference([
      { role: "hook" },
      { role: "body" },
      { role: "body" },
      { role: "cta" },
    ]),
    /하나씩/,
  );
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
