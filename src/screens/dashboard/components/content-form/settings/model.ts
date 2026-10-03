export type ContentSettings = {
  ratio: "4:5" | "1:1" | "9:16";
  language: "한국어" | "English";
};

export function getSettingsSummary(settings: ContentSettings) {
  return `TikTok · ${settings.ratio} · ${settings.language}`;
}
