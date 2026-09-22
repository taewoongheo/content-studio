export type ReferenceAnalysisOutput = {
  sourceLanguage: string;
  outputLanguage: string;
  visualLanguage: { summary: string; imageIds: string[] };
  slides: Array<{
    imageId: string;
    role: string;
    transitionFromPrevious: string;
  }>;
  writingStyle: { summary: string; imageIds: string[] };
  textDensity: { summary: string; imageIds: string[] };
  hook: { originalText: string; pattern: string; imageIds: string[] };
  uncertainties: string[];
};

export type StrategyOutput = {
  evidence: Array<{ id: string; url: string; title: string; summary: string }>;
  strategies: Array<{
    id: string;
    topic: string;
    angle: string;
    referenceFit: string;
    slidePlan: Array<{
      id: string;
      role: string;
      productFact: string;
      evidenceIds: string[];
    }>;
    warnings: string[];
  }>;
  missingInformation: string[];
};

export type CopyOutput = {
  slides: Array<{
    id: string;
    role: string;
    headline: string;
    body: string;
    visualDirection: string;
    transitionFromPrevious: string;
    claimReferences: string[];
  }>;
  uncertainties: string[];
};

export type HookOutput = {
  hooks: Array<{
    id: string;
    text: string;
    pattern: string;
    angle: string;
    supportingSlideIds: string[];
  }>;
  warnings: string[];
};

export type AcceptedStrategyOutput = StrategyOutput & {
  selectedStrategyId: string;
};

export type AcceptedHookOutput = HookOutput & {
  selectedHookId: string;
};
