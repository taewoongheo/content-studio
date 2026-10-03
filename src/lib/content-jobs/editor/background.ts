import type { EditorDocument, ElementDefinition, ElementFrame } from "./types";

export const BACKGROUND_ELEMENT_ID = "__background__";
export const BACKGROUND_PLACEMENT_ID = "__background-placement__";
export const BACKGROUND_FRAME: ElementFrame = { x: 0, y: 0, width: 1, height: 1 };

function makeBackgroundElement(color: string): ElementDefinition {
  return {
    id: BACKGROUND_ELEMENT_ID, name: "배경", role: "슬라이드 전체의 바탕색", kind: "background",
    frame: { ...BACKGROUND_FRAME },
    style: { color: "#111111", backgroundColor: color, fontSize: 36, lineHeight: 1.2, fontWeight: 400,
      textAlign: "center", borderRadius: 0, fontFamily: "sans-serif", imageFit: "cover" },
  };
}

export function ensureSharedBackground(document: EditorDocument): EditorDocument {
  if (document.slides.length === 0) return document;
  for (const element of document.elements) element.style.lineHeight ??= 1.2;
  let background = document.elements.find((element) => element.id === BACKGROUND_ELEMENT_ID);
  if (background && background.kind !== "background") throw new Error("배경 Element ID가 다른 Element에 사용 중입니다.");
  if (!background) {
    background = makeBackgroundElement(document.slides[0].backgroundColor);
    document.elements.push(background);
  }
  for (const slide of document.slides) {
    if (slide.placements.some((placement) => placement.elementId === BACKGROUND_ELEMENT_ID)) continue;
    slide.placements.push({ id: BACKGROUND_PLACEMENT_ID, elementId: BACKGROUND_ELEMENT_ID, value: "",
      frameOverride: null, styleOverride: slide.backgroundColor === background.style.backgroundColor
        ? null : { backgroundColor: slide.backgroundColor } });
  }
  return document;
}

export function syncBackgroundColors(document: EditorDocument) {
  const background = document.elements.find((element) => element.id === BACKGROUND_ELEMENT_ID);
  if (!background) return;
  for (const slide of document.slides) {
    const placement = slide.placements.find((item) => item.elementId === BACKGROUND_ELEMENT_ID);
    if (placement) slide.backgroundColor = placement.styleOverride?.backgroundColor ?? background.style.backgroundColor;
  }
}
