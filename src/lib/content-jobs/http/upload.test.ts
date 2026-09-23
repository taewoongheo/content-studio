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
  form.append("images", new File([pngHeader], "one.png", { type: "image/png" }));
  form.append("images", new File([pngHeader], "two.png", { type: "image/png" }));
  return form;
}

test("stores ordered images with stable IDs and exposes cleanup", async () => {
  const saved = await saveContentJobInput(validForm());
  try {
    assert.deepEqual(
      saved.input.referenceImages.map((image) => image.id),
      ["image-1", "image-2"],
    );
    assert.equal(saved.input.aspectRatio, "9:16");
    assert.equal(saved.input.model, "gpt-6-luna");
    await access(saved.input.referenceImages[0].path);
  } finally {
    await saved.cleanup();
  }
  await assert.rejects(access(saved.input.referenceImages[0].path));
});

test("rejects invalid image signatures before creating a job", async () => {
  const form = validForm();
  form.delete("images");
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
