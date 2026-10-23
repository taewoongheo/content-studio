import type { ProductionStep } from "../../../domain/contracts";
import type { EditorDocument } from "@/domains/slideshow/editor/types";

// Review may improve presentation, but cannot silently turn into a new content task.
export function assertReviewWrite(step: ProductionStep, input: unknown, document: EditorDocument) {
  if (step !== "hook" && step !== "visual") return;
  const commands = (input as { commands?: Array<Record<string, unknown>> }).commands;
  if (!Array.isArray(commands)) throw new Error("검토 단계는 편집 명령 배열이 필요합니다.");
  for (const command of commands) {
    if (step === "visual") {
      if (!["update_visual", "reorder_layers", "set_slide_background", "set_text_colors", "set_text_weights"].includes(String(command.type)))
        throw new Error("시각 검증에서는 문구·이미지를 유지하고 배치와 스타일만 수정할 수 있습니다.");
      continue;
    }
    const slide = document.slides.find(value => value.id === command.slideId);
    const placement = slide?.placements.find(value => value.id === command.placementId);
    const element = document.elements.find(value => value.id === placement?.elementId);
    if (slide?.role !== "hook" || element?.kind !== "text" ||
      !["set_slot_value", "set_text_colors", "set_text_weights", "update_visual"].includes(String(command.type)) ||
      (command.type === "update_visual" && command.scope !== "local"))
      throw new Error("훅 검토에서는 훅 슬라이드의 텍스트와 해당 배치만 수정할 수 있습니다. 본문과 CTA는 유지해 주세요.");
  }
}
