import type { SlideshowStructure } from "../domain/types";
import { validBorder } from "./elements/style";
import { BACKGROUND_ELEMENT_ID, BACKGROUND_FRAME, BACKGROUND_PLACEMENT_ID, ensureSharedBackground, syncBackgroundColors } from "./background";
import type {
  EditorAnalysis,
  EditorCommand,
  EditorDocument,
  EditorSlide,
  ElementFrame,
  ElementStyle,
  PlacedElement,
} from "./types";

const colorPattern = /^#[0-9a-fA-F]{6}$/;
export { BACKGROUND_ELEMENT_ID, BACKGROUND_PLACEMENT_ID, ensureSharedBackground } from "./background";

function validFrame(frame: ElementFrame) {
  return Object.values(frame).every((value) => Number.isFinite(value)) &&
    frame.width > 0 && frame.height > 0;
}

function validStyle(style: ElementStyle) {
  return validBorder(style) && colorPattern.test(style.color) &&
    (colorPattern.test(style.backgroundColor) || style.backgroundColor === "transparent") &&
    Number.isFinite(style.fontSize) && style.fontSize >= 8 && style.fontSize <= 200 &&
    Number.isFinite(style.lineHeight) && style.lineHeight >= 0.8 && style.lineHeight <= 3 &&
    Number.isInteger(style.fontWeight) && style.fontWeight >= 100 && style.fontWeight <= 900 &&
    ["left", "center", "right"].includes(style.textAlign) &&
    Number.isFinite(style.borderRadius) && style.borderRadius >= 0 && style.borderRadius <= 100 &&
    ["sans-serif", "serif", "monospace"].includes(style.fontFamily) &&
    ["cover", "contain"].includes(style.imageFit);
}

function unique(values: string[]) {
  return values.length === new Set(values).size;
}

export function validateEditorDocument(document: EditorDocument): string[] {
  const errors: string[] = [];
  if (Object.values(document.formatNotes).some((value) => !value.trim()))
    errors.push("포맷 규칙을 모두 작성해 주세요.");
  const elementIds = document.elements.map((element) => element.id);
  const slideIds = document.slides.map((slide) => slide.id);
  if (!unique(elementIds) || !unique(slideIds)) errors.push("Element와 슬라이드 ID는 고유해야 합니다.");
  const background = document.elements.find((element) => element.id === BACKGROUND_ELEMENT_ID);
  if (!background || background.kind !== "background" ||
    document.elements.filter((element) => element.kind === "background").length !== 1 ||
    !Object.keys(BACKGROUND_FRAME).every((key) => background.frame[key as keyof ElementFrame] === BACKGROUND_FRAME[key as keyof ElementFrame]))
    errors.push("공통 배경 Element가 올바르지 않습니다.");
  if (document.slides.length < 2 || document.slides.length > 20)
    errors.push("슬라이드 수가 올바르지 않습니다.");
  if (document.structure === "repeating" && document.slides.length < 3)
    errors.push("반복형에는 본문 슬라이드가 한 장 이상 필요합니다.");
  if (document.structure === "repeating" &&
    (document.slides.filter((slide) => slide.role === "hook").length !== 1 ||
      document.slides.filter((slide) => slide.role === "cta").length !== 1))
    errors.push("반복형에는 훅과 CTA가 한 장씩 필요합니다.");
  for (const element of document.elements) {
    if (!element.id || !element.name.trim() || !element.role.trim() ||
      !["background", "text", "image", "rectangle", "circle", "triangle"].includes(element.kind) ||
      !validFrame(element.frame) || !validStyle(element.style))
      errors.push(`Element ${element.id}의 정의가 올바르지 않습니다.`);
  }
  const knownElements = new Set(elementIds);
  for (const slide of document.slides) {
    if (slide.name !== undefined && (typeof slide.name !== "string" || !slide.name.trim() || slide.name.length > 120))
      errors.push(`${slide.id}의 이름은 1~120자여야 합니다.`);
    if (!colorPattern.test(slide.backgroundColor)) errors.push(`${slide.id}의 배경색이 올바르지 않습니다.`);
    const backgroundPlacements = slide.placements.filter((placement) => placement.elementId === BACKGROUND_ELEMENT_ID);
    const backgroundPlacement = backgroundPlacements[0];
    if (backgroundPlacements.length !== 1 || backgroundPlacement.id !== BACKGROUND_PLACEMENT_ID ||
      backgroundPlacement.value !== "" || backgroundPlacement.frameOverride !== null ||
      Object.keys(backgroundPlacement.styleOverride ?? {}).some((key) => key !== "backgroundColor") ||
      slide.backgroundColor !== (backgroundPlacement.styleOverride?.backgroundColor ?? background?.style.backgroundColor))
      errors.push(`${slide.id}의 배경 배치가 올바르지 않습니다.`);
    if (!unique(slide.placements.map((placement) => placement.id)))
      errors.push(`${slide.id}의 배치 ID가 중복됩니다.`);
    for (const placement of slide.placements) {
      if (!knownElements.has(placement.elementId) ||
        (placement.frameOverride !== null && !validFrame(placement.frameOverride)))
        errors.push(`${slide.id}에 유효하지 않은 Element 배치가 있습니다.`);
      if (placement.styleOverride !== null) {
        const original = document.elements.find((element) => element.id === placement.elementId);
        if (original && !validStyle({ ...original.style, ...placement.styleOverride }))
          errors.push(`${slide.id}의 개별 스타일이 올바르지 않습니다.`);
      }
    }
  }
  return errors;
}

export function createDocumentFromAnalysis(
  analysis: EditorAnalysis,
  structure: SlideshowStructure,
  slideCount: number,
  aspectRatio: EditorDocument["aspectRatio"],
): EditorDocument {
  if (analysis.slides.length !== slideCount)
    throw new Error("레퍼런스 분석의 슬라이드 수가 입력과 일치하지 않습니다.");
  if (structure === "repeating" && analysis.slides.some((slide, index) =>
    slide.role !== (index === 0 ? "hook" : index === slideCount - 1 ? "cta" : "body")))
    throw new Error("반복형 레퍼런스의 역할 순서가 올바르지 않습니다.");
  const knownElements = new Set(analysis.elements.map((element) => element.id));
  if (analysis.slides.some((slide) => slide.elementIds.some((id) => !knownElements.has(id))))
    throw new Error("존재하지 않는 Element를 참조합니다.");
  if (knownElements.has(BACKGROUND_ELEMENT_ID)) throw new Error("예약된 배경 Element ID입니다.");
  const makeSlide = (source: EditorAnalysis["slides"][number], index: number): EditorSlide => ({
    id: `slide-${index + 1}`,
    role: source.role,
    backgroundColor: source.backgroundColor,
    placements: source.elementIds.map((elementId, placementIndex): PlacedElement => {
      const visual = source.visuals.find((item) => item.elementId === elementId);
      return {
        id: `placement-${index + 1}-${placementIndex + 1}`,
        elementId,
        value: "",
        frameOverride: visual?.frame ?? null,
        styleOverride: visual?.style ?? null,
      };
    }),
  });
  const slides = analysis.slides.map(makeSlide);
  const document: EditorDocument = {
    version: 1,
    structure,
    aspectRatio,
    formatNotes: structuredClone(analysis.formatNotes),
    elements: structuredClone(analysis.elements),
    slides,
  };
  ensureSharedBackground(document);
  const errors = validateEditorDocument(document);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return document;
}

function requireSlide(document: EditorDocument, slideId: string) {
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) throw new Error("슬라이드를 찾을 수 없습니다.");
  return slide;
}

function requirePlacement(slide: EditorSlide, placementId: string) {
  const placement = slide.placements.find((item) => item.id === placementId);
  if (!placement) throw new Error("배치된 Element를 찾을 수 없습니다.");
  return placement;
}

export function getDuplicateTargets(document: EditorDocument, slideId: string, placementId: string, selectedSlideIds: string[]) {
  const source = requirePlacement(requireSlide(document, slideId), placementId);
  if (source.elementId === BACKGROUND_ELEMENT_ID) throw new Error("배경 Element는 복제할 수 없습니다.");
  const selected = new Set(selectedSlideIds);
  if (!selected.has(slideId)) throw new Error("현재 장을 복제 범위에 포함해 주세요.");
  return document.slides.filter((slide) => selected.has(slide.id)).flatMap((slide) => slide.placements
    .filter((placement) => placement.elementId === source.elementId)
    .map((placement) => ({ slideId: slide.id, sourcePlacementId: placement.id })));
}

function offsetFrame(frame: ElementFrame): ElementFrame {
  const offset = (start: number, size: number) => start + size + 0.03 <= 1
    ? start + 0.03 : start - 0.03 >= 0 ? start - 0.03 : start;
  return { ...frame, x: offset(frame.x, frame.width), y: offset(frame.y, frame.height) };
}

export function applyEditorCommand(document: EditorDocument, command: EditorCommand): EditorDocument {
  const next = ensureSharedBackground(structuredClone(document));
  switch (command.type) {
    case "rename_slide": {
      const name = command.name.trim();
      if (!name || name.length > 120) throw new Error("슬라이드 이름은 1~120자로 입력해 주세요.");
      requireSlide(next, command.slideId).name = name;
      break;
    }
    case "reorder_slides": {
      if (!unique(command.slideIds) || command.slideIds.length !== next.slides.length ||
        command.slideIds.some((id) => !next.slides.some((slide) => slide.id === id)))
        throw new Error("전체 슬라이드 ID를 정확히 한 번씩 지정해 주세요.");
      next.slides = command.slideIds.map((id) => requireSlide(next, id));
      break;
    }
    case "reorder_layers": {
      const slide = requireSlide(next, command.slideId);
      if (!unique(command.placementIds) || command.placementIds.length !== slide.placements.length ||
        command.placementIds.some((id) => !slide.placements.some((item) => item.id === id)) ||
        command.placementIds.at(-1) !== BACKGROUND_PLACEMENT_ID)
        throw new Error("배경을 맨 뒤에 두고 모든 배치 ID를 정확히 한 번씩 지정해 주세요.");
      slide.placements = command.placementIds.map((id) => requirePlacement(slide, id));
      break;
    }
    case "set_slide_background": {
      const slide = requireSlide(next, command.slideId);
      const placement = requirePlacement(slide, BACKGROUND_PLACEMENT_ID);
      placement.styleOverride = { ...placement.styleOverride, backgroundColor: command.color };
      break;
    }
    case "set_slot_value": {
      const placement = requirePlacement(requireSlide(next, command.slideId), command.placementId);
      if (placement.elementId === BACKGROUND_ELEMENT_ID) throw new Error("배경 Element에는 내용을 넣을 수 없습니다.");
      placement.value = command.value;
      break;
    }
    case "update_visual":
      if (command.scope === "common") {
        const element = next.elements.find((item) => item.id === command.elementId);
        if (!element) throw new Error("Element를 찾을 수 없습니다.");
        if (element.kind === "background" && (command.frame ||
          Object.keys(command.style ?? {}).some((key) => key !== "backgroundColor")))
          throw new Error("배경 Element는 배경색만 바꿀 수 있습니다.");
        if (command.frame) element.frame = command.frame;
        if (command.style) element.style = { ...element.style, ...command.style };
        for (const slide of next.slides) {
          for (const placement of slide.placements) {
            if (placement.elementId !== command.elementId) continue;
            if (command.frame) placement.frameOverride = null;
            if (command.style && placement.styleOverride) {
              for (const key of Object.keys(command.style) as Array<keyof ElementStyle>)
                delete placement.styleOverride[key];
              if (Object.keys(placement.styleOverride).length === 0)
                placement.styleOverride = null;
            }
          }
        }
      } else {
        const placement = requirePlacement(requireSlide(next, command.slideId), command.placementId);
        if (placement.elementId === BACKGROUND_ELEMENT_ID && (command.frame ||
          Object.keys(command.style ?? {}).some((key) => key !== "backgroundColor")))
          throw new Error("배경 Element는 배경색만 바꿀 수 있습니다.");
        if (command.frame) placement.frameOverride = command.frame;
        if (command.style) placement.styleOverride = { ...placement.styleOverride, ...command.style };
      }
      break;
    case "update_element": {
      const element = next.elements.find((item) => item.id === command.elementId);
      if (!element) throw new Error("Element를 찾을 수 없습니다.");
      if (element.kind === "background") throw new Error("배경 Element의 정의는 바꿀 수 없습니다.");
      if (command.name !== undefined) element.name = command.name;
      if (command.role !== undefined) element.role = command.role;
      break;
    }
    case "add_element":
      if (command.element.kind === "background" || command.element.id === BACKGROUND_ELEMENT_ID)
        throw new Error("배경 Element는 자동으로 관리됩니다.");
      if (next.elements.some((item) => item.id === command.element.id))
        throw new Error("이미 존재하는 Element ID입니다.");
      next.elements.push(command.element);
      break;
    case "place_element": {
      if (command.elementId === BACKGROUND_ELEMENT_ID || command.placementId === BACKGROUND_PLACEMENT_ID)
        throw new Error("배경 Element는 자동으로 배치됩니다.");
      if (!next.elements.some((item) => item.id === command.elementId))
        throw new Error("Element를 찾을 수 없습니다.");
      const slide = requireSlide(next, command.slideId);
      if (slide.placements.some((item) => item.id === command.placementId))
        throw new Error("이미 존재하는 배치 ID입니다.");
      slide.placements.push({
        id: command.placementId,
        elementId: command.elementId,
        value: "",
        frameOverride: null,
        styleOverride: null,
      });
      break;
    }
    case "add_slide": {
      if (next.slides.length >= 20) throw new Error("슬라이드는 최대 20장입니다.");
      if (!command.newSlideId.trim()) throw new Error("새 슬라이드 ID가 필요합니다.");
      if (next.slides.some((slide) => slide.id === command.newSlideId))
        throw new Error("이미 존재하는 슬라이드 ID입니다.");
      const afterIndex = next.slides.findIndex((slide) => slide.id === command.afterSlideId);
      const source = requireSlide(next, command.sourceSlideId);
      if (afterIndex < 0) throw new Error("삽입 위치의 슬라이드를 찾을 수 없습니다.");
      if (next.structure === "repeating" && source.role !== "body")
        throw new Error("반복형에서는 본문 슬라이드만 추가할 수 있습니다.");
      const slide = structuredClone(source);
      slide.id = command.newSlideId;
      slide.placements = slide.placements.map((placement) => ({
        ...placement,
        id: placement.elementId === BACKGROUND_ELEMENT_ID ? BACKGROUND_PLACEMENT_ID
          : `${command.newSlideId}-${placement.id}`,
        value: command.copyContent ? placement.value : "",
      }));
      next.slides.splice(afterIndex + 1, 0, slide);
      break;
    }
    case "remove_slide": {
      const index = next.slides.findIndex((slide) => slide.id === command.slideId);
      if (index < 0) throw new Error("슬라이드를 찾을 수 없습니다.");
      if (next.structure === "repeating" && next.slides[index].role !== "body")
        throw new Error("반복형의 훅과 CTA 장은 제거할 수 없습니다.");
      if (next.slides.length <= (next.structure === "repeating" ? 3 : 2))
        throw new Error("필수 슬라이드는 제거할 수 없습니다.");
      next.slides.splice(index, 1);
      break;
    }
    case "remove_placement": {
      const slide = requireSlide(next, command.slideId);
      const placement = requirePlacement(slide, command.placementId);
      if (placement.elementId === BACKGROUND_ELEMENT_ID) throw new Error("배경 Element는 삭제할 수 없습니다.");
      slide.placements = slide.placements.filter((item) => item.id !== command.placementId);
      break;
    }
    case "duplicate_placement": {
      const source = requirePlacement(requireSlide(next, command.sourceSlideId), command.sourcePlacementId);
      if (source.elementId === BACKGROUND_ELEMENT_ID) throw new Error("배경 Element는 복제할 수 없습니다.");
      const sourceElement = next.elements.find((element) => element.id === source.elementId);
      if (!sourceElement) throw new Error("원본 Element를 찾을 수 없습니다.");
      if (next.elements.some((element) => element.id === command.newElementId))
        throw new Error("이미 존재하는 Element ID입니다.");
      const selectedSlideIds = [...new Set(command.placements.map((target) => target.slideId))];
      const targets = getDuplicateTargets(next, command.sourceSlideId, command.sourcePlacementId, selectedSlideIds);
      const expected = new Set(targets.map((target) => `${target.slideId}:${target.sourcePlacementId}`));
      const provided = command.placements.map((target) => `${target.slideId}:${target.sourcePlacementId}`);
      if (provided.length !== expected.size || new Set(provided).size !== expected.size ||
        provided.some((key) => !expected.has(key)))
        throw new Error("복제 범위의 모든 배치를 정확히 한 번씩 지정해 주세요.");
      next.elements.push({ ...structuredClone(sourceElement), id: command.newElementId,
        name: `${sourceElement.name} 복사본`, frame: offsetFrame(sourceElement.frame) });
      for (const target of command.placements) {
        const slide = requireSlide(next, target.slideId);
        const original = requirePlacement(slide, target.sourcePlacementId);
        if (slide.placements.some((placement) => placement.id === target.newPlacementId))
          throw new Error("이미 존재하는 배치 ID입니다.");
        const duplicate = { ...structuredClone(original), id: target.newPlacementId, elementId: command.newElementId,
          frameOverride: original.frameOverride ? offsetFrame(original.frameOverride) : null };
        slide.placements.splice(slide.placements.indexOf(original) + 1, 0, duplicate);
      }
      break;
    }
  }
  syncBackgroundColors(next);
  const errors = validateEditorDocument(next);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return next;
}

export function applyEditorCommands(document: EditorDocument, commands: EditorCommand[]) {
  return commands.reduce(applyEditorCommand, document);
}
