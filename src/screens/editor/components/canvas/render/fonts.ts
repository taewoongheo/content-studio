import { editorFont, supportedFontWeight, type EditorFontFamily } from "@/lib/content-jobs/editor/typography/fonts";

export function canvasFont(family: EditorFontFamily, weight: number, style: "normal" | "italic" = "normal") {
  const font = editorFont(family);
  const variables = getComputedStyle(document.documentElement);
  const loadedFamily = variables.getPropertyValue(font.variable).trim().split(",")[0];
  const fallbackFamily = variables.getPropertyValue("--font-geist-sans").trim().split(",")[0];
  const fontStack = [...new Set([loadedFamily, fallbackFamily, font.fallback].filter(Boolean))].join(", ");
  const resolvedWeight = supportedFontWeight(family, weight);
  return { family: fontStack, weight: resolvedWeight, style: `${style} ${resolvedWeight}` };
}
