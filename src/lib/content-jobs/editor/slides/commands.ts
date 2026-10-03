import type { EditorCommand, EditorDocument, EditorSlide } from "../types";

function currentSlide(document: EditorDocument, slideId: string): EditorSlide {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) throw new Error("슬라이드를 찾을 수 없습니다.");
  return slide;
}

export function slideActionCommand(document: EditorDocument, slideId: string,
  action: "add_slide" | "duplicate_slide" | "remove_slide", newSlideId = ""): EditorCommand {
  const slide = currentSlide(document, slideId);
  if (action === "remove_slide") return { type: "remove_slide", slideId };
  if (!newSlideId) throw new Error("새 슬라이드 ID가 필요합니다.");
  if (document.structure === "repeating") {
    const body = action === "duplicate_slide" && slide.role === "body"
      ? slide : document.slides.find((item) => item.role === "body");
    if (!body || (action === "duplicate_slide" && slide.role !== "body"))
      throw new Error("반복형에서는 본문 슬라이드를 복제해 주세요.");
    return { type: "add_slide", afterSlideId: slide.id, sourceSlideId: body.id,
      newSlideId, copyContent: action === "duplicate_slide" };
  }
  return { type: "add_slide", afterSlideId: slide.id, sourceSlideId: slide.id,
    newSlideId, copyContent: action === "duplicate_slide" };
}
