import assert from "node:assert/strict";
import test from "node:test";
import { validateEditorCommands } from "../schema";

const element = {
  id: "heading",
  name: "제목",
  role: "관심을 끈다",
  kind: "text",
  frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.15 },
  style: {
    color: "#111111",
    backgroundColor: "#FFFFFF",
    fontSize: 36,
    lineHeight: 1.2,
    fontWeight: 700,
    textAlign: "center",
    borderRadius: 0,
    fontFamily: "sans-serif",
    imageFit: "cover",
  },
  };

test("편집 명령은 허용된 종류와 필드만 받는다", () => {
  assert.equal(validateEditorCommands({commands:[{type:"add_element",element}]}).ok, true);
  assert.equal(validateEditorCommands({ commands: [{
    type: "set_slot_value", slideId: "slide-1", placementId: "placement-1-1", value: "새 제목",
  }] }).ok, true);
  assert.equal(validateEditorCommands({ commands: [{ type: "delete_all" }] }).ok, false);
  assert.equal(validateEditorCommands({ commands: [{ type: "duplicate_placement",
    sourceSlideId: "slide-2", sourcePlacementId: "placement-2-1", newElementId: "copy",
    placements: [{ slideId: "slide-2", sourcePlacementId: "placement-2-1", newPlacementId: "new-placement" }],
  }] }).ok, true);
  assert.equal(validateEditorCommands({ commands: [{ type: "update_visual", scope: "common",
    elementId: "heading", frame: { x: -0.25, y: 1.1, width: 1.5, height: 0.2 },
  }] }).ok, true);
  assert.equal(validateEditorCommands({ commands: [{
    type: "set_slot_value", slideId: "slide-1", placementId: "placement-1-1", value: "새 제목", extra: true,
  }] }).ok, false);
});
