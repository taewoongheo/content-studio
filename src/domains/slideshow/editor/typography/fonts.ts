const allWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export const EDITOR_FONTS = [
  { value: "oswald", label: "Oswald Bold", group: "훅", variable: "--font-oswald", weights: [700] },
  { value: "inter", label: "Inter", group: "본문", variable: "--font-inter", weights: allWeights },
] as const;
export type EditorFontFamily = typeof EDITOR_FONTS[number]["value"];
export const EDITOR_FONT_FAMILIES = EDITOR_FONTS.map((font) => font.value);
export function editorFont(family: EditorFontFamily) {
  return EDITOR_FONTS.find((font) => font.value === family) ?? EDITOR_FONTS[1];
}
export function supportedFontWeight(family: EditorFontFamily, requested: number) {
  return (editorFont(family).weights as readonly number[]).reduce((best, weight) =>
    Math.abs(weight - requested) < Math.abs(best - requested) ? weight : best);
}

/** Read older projects with retired fonts; new commands only accept the current catalog. */
export function retiredFontReplacement(family: string): EditorFontFamily | undefined {
  if (["anton", "bebas-neue", "barlow-condensed"].includes(family)) return "oswald";
  if (["source-sans-3", "space-grotesk", "sans-serif", "serif", "monospace"].includes(family)) return "inter";
}
