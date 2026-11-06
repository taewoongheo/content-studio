import { isDeepStrictEqual } from "node:util";
import type { EditorDocument } from "@/domains/slideshow/editor/types";
import { OperationError } from "@/lib/errors/operation";

function structure(document: EditorDocument) {
  const elements = new Map(document.elements.map(element => [element.id, element]));
  return {
    structure: document.structure,
    slides: document.slides.map(slide => ({
      id: slide.id, role: slide.role,
      placements: slide.placements.map(placement => ({
        id: placement.id, kind: elements.get(placement.elementId)?.kind,
      })),
    })),
  };
}

/** Meaning and visual fidelity require review; count/order/slot changes do not. */
export function assertSourceStructure(source: EditorDocument, draft: EditorDocument) {
  const expected = structure(source);
  if (!isDeepStrictEqual(expected, structure(draft)))
    throw new OperationError("SOURCE_FORMAT_MISMATCH",
      "원본의 장 수·순서·역할·요소 구성을 유지해 주세요. 새 설명 페이지나 슬롯을 추가하지 말고 기존 슬롯의 내용만 교체해 주세요.",
      { expected });
}
