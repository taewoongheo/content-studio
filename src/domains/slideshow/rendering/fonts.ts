import { editorFont, supportedFontWeight, type EditorFontFamily } from "@/domains/slideshow/editor/typography/fonts";

export function canvasFont(family: EditorFontFamily, weight: number, style: "normal" | "italic" = "normal") {
  const font = editorFont(family);
  const variables = getComputedStyle(document.documentElement);
  const loadedFamily = variables.getPropertyValue(font.variable).trim().split(",")[0];
  const resolvedWeight = supportedFontWeight(family, weight);
  return { family: loadedFamily, weight: resolvedWeight, style: `${style} ${resolvedWeight}` };
}
