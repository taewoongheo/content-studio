export type SavedProjectSummary = {
  id: string;
  name: string;
  aspectRatio: string;
  slideCount: number;
  outputLanguage: string;
  composition: string;
  /** Derived from templateOrder; no separate persisted flag. */
  isTemplate: boolean;
  registeredTemplateName: string | null;
  sourceTemplateExcluded: boolean;
  templateOrder: number | null;
  sourceTemplateProjectId: string | null;
  sourceTemplateName: string | null;
  topic: string;
  message: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

