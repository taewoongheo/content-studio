export type SlideshowSummary = {
  id: string;
  name: string;
  aspectRatio: string;
  slideCount: number;
  outputLanguage: string;
  topic: string;
  message: string;
  createdAt: string;
  updatedAt: string;
};
export type SavedProjectSummary = SlideshowSummary & {
  sourceTemplateId: string | null;
  sourceTemplateName: string | null;
  publishedAt: string | null;
};
export type SavedTemplateSummary = SlideshowSummary & {
  composition: string;
  templateOrder: number | null;
};
