import { randomUUID } from "node:crypto";
import { makeElementDefinition } from "@/domains/slideshow/editor/elements/factory";
import type { EditorCommand, EditorDocument } from "@/domains/slideshow/editor/types";

export function badgeElementIds(document: EditorDocument) {
  const ids = new Set(document.elements.filter(element => element.kind !== "background" &&
    /badge|뱃지|배지/i.test(`${element.id} ${element.name} ${element.role}`)).map(element => element.id));
  for (const slide of document.slides) for (const placement of slide.placements)
    if (placement.value.trim().toUpperCase() === "LIFTCODE") ids.add(placement.elementId);
  return ids;
}

// Restore the approved specification, never a model-provided interpretation of it.
export function badgeRepairCommands(document: EditorDocument): EditorCommand[] {
  const ids = badgeElementIds(document);
  const background = makeElementDefinition({ id: randomUUID(), kind: "rectangle", name: "LIFTCODE badge background", role: "badge" });
  background.frame = { x: 0.04, y: 0.9144, width: 0.1783550709144038, height: 0.04564114259649923 };
  Object.assign(background.style, { color: "#000000", backgroundColor: "#000000", borderRadius: 99, rotation: 0, borderEnabled: false });
  const label = makeElementDefinition({ id: randomUUID(), kind: "text", name: "LIFTCODE badge label", role: "badge" });
  label.frame = { x: 0.0591, y: 0.9179999999999999, width: 0.14557052241465326, height: 0.03899880266833913 };
  Object.assign(label.style, { color: "#FFFFFF", backgroundColor: "transparent", fontFamily: "inter", fontSize: 25,
    fontWeight: 700, lineHeight: 1.2, textAlign: "center", borderRadius: 0, fontStyle: "normal", rotation: 0, borderEnabled: false });
  const commands: EditorCommand[] = [];
  for (const slide of document.slides) for (const placement of slide.placements)
    if (ids.has(placement.elementId)) commands.push({ type: "remove_placement", slideId: slide.id, placementId: placement.id });
  for (const elementId of ids) commands.push({ type: "remove_element", elementId });
  commands.push({ type: "add_element", element: background }, { type: "add_element", element: label });
  for (const slide of document.slides) {
    const backgroundId = randomUUID(), labelId = randomUUID();
    commands.push(
      { type: "place_element", slideId: slide.id, elementId: background.id, placementId: backgroundId },
      { type: "place_element", slideId: slide.id, elementId: label.id, placementId: labelId },
      { type: "set_slot_value", slideId: slide.id, placementId: labelId, value: "LIFTCODE" },
    );
  }
  return commands;
}
