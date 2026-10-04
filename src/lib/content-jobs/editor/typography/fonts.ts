const allWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export const EDITOR_FONTS = [
  { value: "anton", label: "Anton", group: "훅", variable: "--font-anton", fallback: "sans-serif", weights: [400] },
  { value: "inter", label: "Inter", group: "본문", variable: "--font-inter", fallback: "sans-serif", weights: allWeights },
  { value: "space-grotesk", label: "Space Grotesk", group: "본문 제목", variable: "--font-space-grotesk", fallback: "sans-serif", weights: [300, 400, 500, 600, 700] },
  { value: "sans-serif", label: "Geist · 기본 대체", group: "Fallback", variable: "--font-geist-sans", fallback: "sans-serif", weights: allWeights },
] as const;
export type EditorFontFamily = typeof EDITOR_FONTS[number]["value"];
export const EDITOR_FONT_FAMILIES = EDITOR_FONTS.map((font) => font.value);
export function editorFont(family: EditorFontFamily) {
  return EDITOR_FONTS.find((font) => font.value === family) ?? EDITOR_FONTS[3];
}
export function supportedFontWeight(family: EditorFontFamily, requested: number) {
  return (editorFont(family).weights as readonly number[]).reduce((best, weight) =>
    Math.abs(weight - requested) < Math.abs(best - requested) ? weight : best);
}

/** Read older projects with retired fonts; new commands only accept the current catalog. */
export function retiredFontReplacement(family: string): EditorFontFamily | undefined {
  if (["bebas-neue", "oswald", "barlow-condensed"].includes(family)) return "anton";
  if (family === "source-sans-3") return "inter";
  if (["serif", "monospace"].includes(family)) return "sans-serif";
}
