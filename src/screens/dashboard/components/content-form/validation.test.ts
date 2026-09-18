import assert from "node:assert/strict";
import test from "node:test";
import { getSettingsSummary, type Materials } from "./model";
import {
  MAX_REFERENCE_IMAGE_BYTES,
  validateMaterials,
  validateReferenceImages,
} from "./validation";

const empty: Materials = {
  reference: "",
  referenceText: "",
  files: [],
  template: "문제 → 해결",
  notes: "",
};
const image = { name: "reference.png", type: "image/png", size: 1024 } as File;

test("reference requires material for the active content type", () => {
  assert.match(validateMaterials("slideshow", "reference", empty), /이미지/);
  for (const type of ["video", "text"] as const) {
    assert.match(validateMaterials(type, "reference", empty), /참고할 내용/);
    assert.notEqual(
      validateMaterials(type, "reference", { ...empty, files: [image] }),
      "",
    );
    assert.equal(
      validateMaterials(type, "reference", { ...empty, referenceText: "원문" }),
      "",
    );
  }
  assert.notEqual(
    validateMaterials("slideshow", "reference", {
      ...empty,
      referenceText: "원문",
    }),
    "",
  );
  assert.equal(
    validateMaterials("slideshow", "reference", { ...empty, files: [image] }),
    "",
  );
});

test("whitespace and notes do not count as reference material", () => {
  for (const type of ["slideshow", "video", "text"] as const) {
    assert.notEqual(
      validateMaterials(type, "reference", {
        ...empty,
        reference: "  ",
        referenceText: "\n",
        notes: "추가 요청",
      }),
      "",
    );
  }
});

test("all content types accept HTTP and HTTPS references", () => {
  for (const type of ["slideshow", "video", "text"] as const) {
    for (const reference of [
      "http://example.com",
      "https://example.com/reference",
    ]) {
      assert.equal(
        validateMaterials(type, "reference", { ...empty, reference }),
        "",
      );
    }
  }
});

test("invalid links block review even when alternate reference material exists", () => {
  for (const type of ["slideshow", "video", "text"] as const) {
    for (const reference of [
      "example",
      "https://",
      "ftp://example.com",
      "javascript:alert(1)",
    ]) {
      assert.match(
        validateMaterials(type, "reference", {
          ...empty,
          reference,
          files: [image],
          referenceText: "원문",
        }),
        /https:\/\//,
      );
    }
  }
});

test("template and scratch ignore hidden reference inputs", () => {
  for (const type of ["slideshow", "video", "text"] as const) {
    for (const method of ["template", "scratch"] as const) {
      assert.equal(validateMaterials(type, method, empty), "");
      assert.equal(
        validateMaterials(type, method, { ...empty, reference: "invalid" }),
        "",
      );
    }
  }
});

test("image limits include existing files and allow exactly 5 images at 10MB", () => {
  const maximumImage = { type: "image/png", size: MAX_REFERENCE_IMAGE_BYTES };
  assert.equal(validateReferenceImages(4, [maximumImage]), "");
  assert.notEqual(validateReferenceImages(5, [maximumImage]), "");
  assert.notEqual(
    validateReferenceImages(0, [
      { ...maximumImage, size: MAX_REFERENCE_IMAGE_BYTES + 1 },
    ]),
    "",
  );
});

test("all uploaded files must be supported images", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(validateReferenceImages(0, [{ type, size: 1024 }]), "");
  }
  for (const type of ["image/gif", "video/mp4", ""]) {
    assert.notEqual(
      validateReferenceImages(0, [image, { type, size: 1024 }]),
      "",
    );
  }
});

test("review summarizes only the active type's settings", () => {
  const settings = {
    ratio: "4:5",
    count: "6장",
    videoRatio: "9:16",
    duration: "30초",
    channel: "SNS 게시글",
    length: "보통 · 약 500자",
    language: "한국어",
  };
  assert.equal(getSettingsSummary("slideshow", settings), "4:5 · 6장 · 한국어");
  assert.equal(getSettingsSummary("video", settings), "9:16 · 30초 · 한국어");
  assert.equal(
    getSettingsSummary("text", settings),
    "SNS 게시글 · 보통 · 약 500자 · 한국어",
  );
});
