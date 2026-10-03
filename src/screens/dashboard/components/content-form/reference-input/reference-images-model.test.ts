import assert from "node:assert/strict";
import test from "node:test";
import {
  createReferenceImageDrafts,
  reorderReferenceImages,
} from "./reference-images-model";

function image(name: string) {
  return new File([name], name, { type: "image/png" });
}

test("creates stable draft identifiers without changing the files", () => {
  const files = [image("one.png"), image("two.png")];
  const ids = ["draft-1", "draft-2"];
  const drafts = createReferenceImageDrafts(
    files,
    () => ids.shift() ?? "",
    (file) => `preview:${file.name}`,
  );

  assert.deepEqual(
    drafts.map((draft) => draft.id),
    ["draft-1", "draft-2"],
  );
  assert.deepEqual(
    drafts.map((draft) => draft.file),
    files,
  );
  assert.deepEqual(
    drafts.map((draft) => draft.previewUrl),
    ["preview:one.png", "preview:two.png"],
  );
});

test("reorders images by stable identifiers without mutating the source", () => {
  const source = createReferenceImageDrafts(
    [image("one.png"), image("two.png"), image("three.png")],
    (() => {
      let id = 0;
      return () => `draft-${++id}`;
    })(),
    (file) => `preview:${file.name}`,
  );

  const reordered = reorderReferenceImages(source, "draft-1", "draft-3");

  assert.deepEqual(
    reordered.map((draft) => draft.file.name),
    ["two.png", "three.png", "one.png"],
  );
  assert.deepEqual(
    source.map((draft) => draft.file.name),
    ["one.png", "two.png", "three.png"],
  );
});

test("keeps the same reference when a drag target is missing", () => {
  const source = createReferenceImageDrafts(
    [image("one.png")],
    () => "draft-1",
    (file) => `preview:${file.name}`,
  );

  assert.equal(
    reorderReferenceImages(source, "draft-1", "missing"),
    source,
  );
});
