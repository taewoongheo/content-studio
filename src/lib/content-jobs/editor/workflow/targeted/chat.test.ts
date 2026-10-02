import assert from "node:assert/strict";
import test from "node:test";
import { ensureSharedBackground } from "../../document";
import { makeElementDefinition } from "../../elements/factory";
import type { EditorDocument } from "../../types";
import { resolveChatTarget, selectedPlacements, targetedMutationCommands } from "./chat";

test("채팅 대상은 Element가 없는 선택 장을 허용하지만 스타일은 존재하는 배치만 변경한다", () => {
  const element = makeElementDefinition({ id: "shape", kind: "circle", sourceImageId: "image-1" });
  const document = ensureSharedBackground({ version: 1, structure: "sequential", aspectRatio: "4:5",
    formatNotes: { visualRules: "기본", writingStyle: "기본", hookPattern: "기본", bodyProgression: "기본" },
    elements: [element], slides: ["a", "b", "c"].map((id) => ({ id, role: "body", backgroundColor: "#FFFFFF",
      placements: id === "b" ? [{ id: "p-b", elementId: "shape", value: "", frameOverride: null, styleOverride: null }] : [] })) } as EditorDocument);
  const target = resolveChatTarget(document, { slideId: "b", placementId: "p-b", elementId: "shape", slideIds: ["a", "b", "c"] });
  assert.deepEqual(selectedPlacements(document, target), [{ slideId: "b", placementId: "p-b" }]);
  const commands = targetedMutationCommands(document, target, {
    intent: "edit", reply: "수정", name: null, role: null, frame: null,
    style: { backgroundColor: "#FF0000", color: null, fontSize: null, lineHeight: null,
      fontWeight: null, textAlign: null, borderRadius: null, fontFamily: null, imageFit: null }, slotValues: [],
  });
  assert.deepEqual(commands, [{ type: "update_visual", scope: "common", elementId: "shape", style: { backgroundColor: "#FF0000" } }]);
  assert.throws(() => resolveChatTarget(document, { ...target, slideIds: ["b", "missing"] }));
});
