import { assertEnglish } from "@/lib/text/english";
import type { EditorDocument } from "../../../editor/types";

export function isEnglishProject(language: string) {
  return /^(en|en[-_][a-z]+|english)$/i.test(language);
}

export function assertDocumentEnglish(value: unknown, language: string) {
  if (!isEnglishProject(language) || !value || typeof value !== "object") return;
  const document = value as EditorDocument;
  if (!Array.isArray(document.elements) || !Array.isArray(document.slides)) return;
  const textElements = new Set(document.elements.filter(element => element.kind === "text").map(element => element.id));
  for (const slide of document.slides)
    for (const placement of slide.placements)
      if (textElements.has(placement.elementId))
        assertEnglish(placement.value, `slides.${slide.id}.${placement.id}`);
}
