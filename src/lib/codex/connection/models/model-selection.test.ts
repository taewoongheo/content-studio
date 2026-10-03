import assert from "node:assert/strict";
import test from "node:test";
import {
  selectEconomicalModel,
  visibleImageModels,
  type CodexModel,
} from "./model-selection";

function model(
  value: string,
  options: Partial<CodexModel> = {},
): CodexModel {
  return {
    id: value,
    model: value,
    displayName: value,
    description: "",
    hidden: false,
    isDefault: false,
    inputModalities: ["text", "image"],
    ...options,
  };
}

test("shows only visible models that support image input", () => {
  assert.deepEqual(
    visibleImageModels([
      model("visible"),
      model("hidden", { hidden: true }),
      model("text-only", { inputModalities: ["text"] }),
    ]).map((item) => item.model),
    ["visible"],
  );
});

test("prefers GPT-6 Luna as the economical default", () => {
  const models = [
    model("gpt-6-sol", { isDefault: true }),
    model("gpt-5.6-luna"),
    model("gpt-6-luna"),
  ];

  assert.equal(selectEconomicalModel(models)?.model, "gpt-6-luna");
});

test("falls back to another Luna model and then the catalog default", () => {
  assert.equal(
    selectEconomicalModel([
      model("gpt-6-sol", { isDefault: true }),
      model("gpt-5.6-luna"),
    ])?.model,
    "gpt-5.6-luna",
  );
  assert.equal(
    selectEconomicalModel([
      model("gpt-6-sol", { isDefault: true }),
      model("gpt-6-astra"),
    ])?.model,
    "gpt-6-sol",
  );
});
