const allWeights = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export const EDITOR_FONTS = [
  { value: "sans-serif", label: "고딕 · Geist", variable: "--font-geist-sans", fallback: "sans-serif", weights: allWeights },
  { value: "serif", label: "명조", variable: "", fallback: "serif", weights: [400, 700] },
  { value: "monospace", label: "고정폭 · Geist Mono", variable: "--font-geist-mono", fallback: "monospace", weights: allWeights },
  { value: "bebas-neue", label: "Bebas Neue · 길고 좁은 훅", variable: "--font-bebas-neue", fallback: "sans-serif", weights: [400] },
  { value: "anton", label: "Anton · 두꺼운 훅", variable: "--font-anton", fallback: "sans-serif", weights: [400] },
  { value: "oswald", label: "Oswald · 좁은 제목", variable: "--font-oswald", fallback: "sans-serif", weights: [200, 300, 400, 500, 600, 700] },
  { value: "barlow-condensed", label: "Barlow Condensed · 좁은 제목", variable: "--font-barlow-condensed", fallback: "sans-serif", weights: allWeights },
] as const;
export type EditorFontFamily = typeof EDITOR_FONTS[number]["value"];
export const EDITOR_FONT_FAMILIES = EDITOR_FONTS.map((font) => font.value);
export function editorFont(family: EditorFontFamily) {
  return EDITOR_FONTS.find((font) => font.value === family)!;
}
export function supportedFontWeight(family: EditorFontFamily, requested: number) {
  return (editorFont(family).weights as readonly number[]).reduce((best, weight) =>
    Math.abs(weight - requested) < Math.abs(best - requested) ? weight : best);
}
