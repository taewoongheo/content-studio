import { test } from "node:test";
import assert from "node:assert/strict";
import { makeElementDefinition } from "../elements/factory";
import { inspectSharedElements } from "./shared-elements";
import { applyEditorCommands, ensureSharedBackground } from "../document";
import type { EditorDocument } from "../types";

function fixture(kind: "text" | "image" | "rectangle" = "text"): EditorDocument {
  const a = makeElementDefinition({ id: "a", kind });
  const b = { ...structuredClone(a), id: "b", role: "Different role" };
  return ensureSharedBackground({ version: 1, structure: "sequential", aspectRatio: "4:5", elements: [a, b], slides: [a, b].map((e, i) => ({
    id: `s${i}`, role: "body", backgroundColor: "#FFFFFF", placements: [{ id: `p${i}`, elementId: e.id, value: i ? "Different" : "Content", frameOverride: null, styleOverride: null }],
  })) });
}
test("warns across bodies with different roles/content, including exact pixel boundaries", () => {
  const doc = fixture();
  doc.slides[1].placements[0].frameOverride = { ...doc.elements[1].frame, x: doc.elements[0].frame.x + 7 / 1080 };
  doc.elements[1].style.fontSize += 4;
  assert.equal(inspectSharedElements(doc).length, 1);
  doc.slides[1].placements[0].frameOverride.x += .01 / 1080;
  assert.deepEqual(inspectSharedElements(doc), []);
});
test("uses resolved overrides and exact normalized colors, skips hooks and shared IDs", () => {
  const doc = fixture();
  doc.elements[0].style.color = "#aabbcc";
  doc.elements[1].style.color = "#AABBCC";
  assert.equal(inspectSharedElements(doc).length, 1);
  doc.slides[1].placements[0].styleOverride = { color: "#AABBCD" };
  assert.equal(inspectSharedElements(doc).length, 0);
  doc.slides[1].placements[0].styleOverride = null;
  doc.slides[1].role = "hook";
  assert.equal(inspectSharedElements(doc).length, 0);
  doc.slides[1].role = "body";
  doc.slides[1].placements[0].elementId = "a";
  assert.equal(inspectSharedElements(doc).length, 0);
});
test("images ignore colors, shapes require fill and border; size uses source resolution", () => {
  const doc = fixture("image");
  doc.elements[1].style.color = "#FFFFFF";
  doc.elements[1].frame.width += 20 / 1080;
  assert.equal(inspectSharedElements(doc).length, 1);
  doc.elements[1].frame.height += 20.01 / 1350;
  assert.equal(inspectSharedElements(doc).length, 0);
  const shape = fixture("rectangle");
  shape.elements[1].style.borderEnabled = false;
  assert.equal(inspectSharedElements(shape).length, 0);
});
test("rebind preserves content, visual overrides and layer order while sharing definition", () => {
  const doc = fixture();
  doc.elements[1].style.fontSize = 50;
  doc.elements[0].style.rotation = 30;
  const result = applyEditorCommands(doc, [{ type: "rebind_element", slideId: "s1", placementId: "p1", elementId: "a" }]);
  const placement = result.slides[1].placements[0];
  assert.equal(placement.elementId, "a");
  assert.equal(placement.value, "Different");
  assert.equal(placement.styleOverride?.fontSize, 50);
  assert.equal(placement.styleOverride?.rotation, 0);
  assert.deepEqual(placement.frameOverride ?? result.elements.find(e => e.id === placement.elementId)!.frame, doc.elements[1].frame);
  assert.equal(doc.slides[1].placements[0].elementId, "b");
});
test("grouping retains exact matches without inferring transitive similarity", () => {
  const doc = fixture();
  doc.elements[1].frame.x += 7 / 1080;
  const c = { ...structuredClone(doc.elements[0]), id: "c", frame: { ...doc.elements[0].frame, x: doc.elements[0].frame.x + 14 / 1080 } };
  doc.elements.push(c);
  const slide = structuredClone(doc.slides[0]); slide.id = "s2";
  slide.placements[0].id = "p2"; slide.placements[0].elementId = c.id; doc.slides.push(slide);
  const warnings = inspectSharedElements(doc);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].matches.length, 2);
  assert.equal(warnings[0].matches.some(pair => pair.first.elementId === "a" && pair.second.elementId === "c"), false);
});
