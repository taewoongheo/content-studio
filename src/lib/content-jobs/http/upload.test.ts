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
    assert.equal(saved.input.slideCount, 6);
    assert.deepEqual(saved.input.referenceImages.map((image) => image.role), Array(6).fill(null));
    await access(saved.input.referenceImages[0].path);
  } finally {
    await saved.cleanup();
  }
  await assert.rejects(access(saved.input.referenceImages[0].path));
});

test("슬라이드 수는 이미지 수로 결정하고 최소 장수를 확인한다", async () => {
  const form = validForm();
  form.delete("images");
  form.append("images", new File([pngHeader], "1.png", { type: "image/png" }));
  await assert.rejects(saveContentJobInput(form), /최소 2장/);
});

test("반복형도 모든 이미지를 순서대로 저장하고 역할을 자동 지정한다", async () => {
  const form = validForm();
  form.set("structure", "repeating");
  const saved = await saveContentJobInput(form);
  try {
    assert.equal(saved.input.structure, "repeating");
    assert.equal(saved.input.slideCount, 6);
    assert.deepEqual(
      saved.input.referenceImages.map((image) => image.role),
      ["hook", "body", "body", "body", "body", "cta"],
    );
  } finally {
    await saved.cleanup();
  }
});

test("반복형은 본문을 포함한 최소 세 장이 필요하다", async () => {
  const form = validForm();
  form.set("structure", "repeating");
  form.delete("images");
  for (let index = 0; index < 2; index++)
    form.append("images", new File([pngHeader], `${index}.png`, { type: "image/png" }));
  await assert.rejects(saveContentJobInput(form), /최소 3장/);
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
