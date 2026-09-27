import { randomUUID } from "node:crypto";
import { getDuplicateTargets } from "../../document";
import type { EditorChatTarget, EditorCommand, EditorDocument } from "../../types";
import { selectedPlacements } from "../targeted/chat";

export function duplicateElementCommand(document: EditorDocument, target: EditorChatTarget): EditorCommand {
  const targets = getDuplicateTargets(document, target.slideId, target.placementId, target.slideIds);
  return { type: "duplicate_placement", sourceSlideId: target.slideId,
    sourcePlacementId: target.placementId, newElementId: randomUUID(),
    placements: targets.map((item) => ({ ...item, newPlacementId: randomUUID() })) };
}

export function removeElementCommands(document: EditorDocument, target: EditorChatTarget): EditorCommand[] {
  return selectedPlacements(document, target).map(({ slideId, placementId }) => ({
    type: "remove_placement", slideId, placementId,
  }));
}
