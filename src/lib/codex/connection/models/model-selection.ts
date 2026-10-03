export type CodexModel = {
  id: string;
  model: string;
  displayName: string;
  description: string;
  hidden: boolean;
  isDefault: boolean;
  inputModalities: string[];
};

export function visibleImageModels(models: CodexModel[]) {
  return models.filter(
    (model) => !model.hidden && model.inputModalities.includes("image"),
  );
}

export function selectEconomicalModel(models: CodexModel[]) {
  const available = visibleImageModels(models);
  return (
    available.find((model) => model.model === "gpt-6-luna") ??
    available.find((model) => model.model.includes("luna")) ??
    available.find((model) => model.isDefault) ??
    available[0]
  );
}
