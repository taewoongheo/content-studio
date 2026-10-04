import assert from "node:assert/strict";
import test from "node:test";
import { createBlankDocument, applyEditorCommands, validateEditorDocument } from "../document";
import { makeElementDefinition } from "../elements/factory";
import { validateEditorCommands } from "../schema";

test("훅 폰트는 편집 명령·문서 검증·JSON 왕복에서 지원하고 알 수 없는 폰트는 거부한다", () => {
  const document = createBlankDocument({ structure: "sequential", aspectRatio: "4:5", slideCount: 3 });
  for (const family of ["bebas-neue", "anton", "oswald", "barlow-condensed"] as const) {
    const element = makeElementDefinition({ id: family, kind: "text" });
    element.style.fontFamily = family;
    const commands = [{ type: "add_element", element }];
    assert.equal(validateEditorCommands({ commands }).ok, true);
    const next = applyEditorCommands(document, commands as Parameters<typeof applyEditorCommands>[1]);
    assert.deepEqual(validateEditorDocument(JSON.parse(JSON.stringify(next))), []);
  }
  assert.equal(validateEditorCommands({ commands: [{ type: "update_visual", scope: "common",
    elementId: "title", style: { fontFamily: "unknown-font" } }] }).ok, false);
});
