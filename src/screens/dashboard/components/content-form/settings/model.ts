export type ContentSettings = {
  ratio: "4:5" | "1:1" | "9:16";
  count: string;
  language: "한국어" | "English";
};

export function getSettingsSummary(settings: ContentSettings) {
  return `TikTok · ${settings.ratio} · ${settings.count} · ${settings.language}`;
}

export function slideCount(settings: ContentSettings) {
  return Number.parseInt(settings.count, 10);
}
