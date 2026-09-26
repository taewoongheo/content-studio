import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import test from "node:test";
import { ContentJobInputError, saveContentJobInput } from "./upload";

const pngHeader = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function validForm() {
  const form = new FormData();
  form.set("model", "gpt-6-luna");
  form.set(
    "productContext",
    JSON.stringify({
      name: "LiftCode",
      description: "운동 기록 앱",
      audience: "운동 사용자",
      constraints: "과장 금지",
    }),
  );
  form.set("aspectRatio", "9:16");
  form.set("slideCount", "6");
  form.set("outputLanguage", "한국어");
  form.set("structure", "sequential");
  for (let index = 0; index < 6; index++)
    form.append("images", new File([pngHeader], `${index + 1}.png`, { type: "image/png" }));
  return form;
}

test("stores ordered images with stable IDs and exposes cleanup", async () => {
  const saved = await saveContentJobInput(validForm());
  try {
    assert.deepEqual(
      saved.input.referenceImages.map((image) => image.id),
      ["image-1", "image-2", "image-3", "image-4", "image-5", "image-6"],
    );
    assert.equal(saved.input.aspectRatio, "9:16");
    assert.equal(saved.input.model, "gpt-6-luna");
    assert.equal(saved.input.structure, "sequential");
    assert.deepEqual(saved.input.referenceImages.map((image) => image.role), Array(6).fill(null));
    await access(saved.input.referenceImages[0].path);
  } finally {
    await saved.cleanup();
  }
  await assert.rejects(access(saved.input.referenceImages[0].path));
});

test("장면별 구성은 슬라이드 수만큼 이미지를 요구한다", async () => {
  const form = validForm();
  form.set("slideCount", "5");
  await assert.rejects(saveContentJobInput(form), /슬라이드 수/);
});

test("stores three labeled representative images for a repeating slideshow", async () => {
  const form = validForm();
  form.set("structure", "repeating");
  form.delete("images");
  for (const role of ["hook", "body", "cta"]) {
    form.append("images", new File([pngHeader], `${role}.png`, { type: "image/png" }));
    form.append("imageRoles", role);
  }
  const saved = await saveContentJobInput(form);
  try {
    assert.equal(saved.input.structure, "repeating");
    assert.deepEqual(
      saved.input.referenceImages.map((image) => image.role),
      ["hook", "body", "cta"],
    );
  } finally {
    await saved.cleanup();
  }
});

test("rejects incomplete or mismatched repeating references", async () => {
  const form = validForm();
  form.set("structure", "repeating");
  form.append("imageRoles", "hook");
  form.append("imageRoles", "body");
  await assert.rejects(saveContentJobInput(form), /훅.*반복 본문.*CTA/);
});

test("rejects invalid image signatures before creating a job", async () => {
  const form = validForm();
  form.delete("images");
  for (let index = 0; index < 5; index++)
    form.append("images", new File([pngHeader], `${index + 1}.png`, { type: "image/png" }));
  form.append(
    "images",
    new File(["not an image"], "fake.png", { type: "image/png" }),
  );
  await assert.rejects(
    saveContentJobInput(form),
    (error: unknown) =>
      error instanceof ContentJobInputError && /형식/.test(error.message),
  );
});

test("rejects unsupported aspect ratios", async () => {
  const form = validForm();
  form.set("aspectRatio", "16:9");
  await assert.rejects(
    saveContentJobInput(form),
    (error: unknown) =>
      error instanceof ContentJobInputError && /화면 비율/.test(error.message),
  );
});
