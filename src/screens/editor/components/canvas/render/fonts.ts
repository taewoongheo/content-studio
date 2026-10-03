import { editorFont, supportedFontWeight, type EditorFontFamily } from "@/lib/content-jobs/editor/typography/fonts";

export function canvasFont(family: EditorFontFamily, weight: number) {
  const font = editorFont(family);
  const loadedFamily = font.variable
    ? getComputedStyle(document.documentElement).getPropertyValue(font.variable).trim() : "";
  return { family: loadedFamily || font.fallback, weight: supportedFontWeight(family, weight) };
}
