export type ContentSettings = {
  ratio: "4:5" | "9:16";
  language: "한국어" | "English";
};

export const CONTENT_SIZE_PRESETS = [
  { ratio: "4:5", width: 1080, height: 1350, label: "4:5 · 1080×1350" },
  { ratio: "9:16", width: 1080, height: 1920, label: "9:16 · 1080×1920" },
] as const;

export const DEFAULT_CONTENT_SETTINGS: ContentSettings = {
  ratio: "4:5",
  language: "English",
};

export function getSettingsSummary(settings: ContentSettings) {
  const preset = CONTENT_SIZE_PRESETS.find((item) => item.ratio === settings.ratio);
  return `TikTok · ${preset?.label ?? settings.ratio} · ${settings.language}`;
}
