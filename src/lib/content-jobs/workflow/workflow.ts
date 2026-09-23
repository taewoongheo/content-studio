import type { CodexConnectionManager } from "../../codex/connection/connection";
import type { CodexJsonValue, CodexUserInput } from "../../codex/transport/types";
import {
  acceptStage,
  proposeStage,
  transitionJob,
  type ContentJobStatus,
  type ContentStage,
} from "../domain/domain";
import {
  validateCopyOutput,
  validateHookOutput,
  validateReferenceOutput,
  validateStrategyOutput,
} from "../structured-output/output-validation";
import {
  copyPrompt,
  hookPrompt,
  referenceAnalysisPrompt,
  strategyPrompt,
} from "./prompts";
import {
  copySchema,
  hookSchema,
  referenceAnalysisSchema,
  strategySchema,
  validateStructuredOutput,
  type CopyOutput,
  type HookOutput,
  type ReferenceAnalysisOutput,
  type StrategyOutput,
  type StructuredOutputSchema,
} from "../structured-output/schemas";
import { ContentJobError, ContentJobRegistry } from "./registry";
import type { ContentJobInput, ContentJobRecord } from "../domain/types";

type CodexWorkflowClient = Pick<
  CodexConnectionManager,
  "connect" | "startThread" | "runStructuredTurn"
>;

type WorkflowOptions = {
  cwd?: string;
};

type RegenerationRequest = {
  expectedRevision: number;
  guidance: string;
  draft: unknown;
};

function schemaValue(schema: StructuredOutputSchema) {
  return schema as CodexJsonValue;
}

function stageRecord(value: object) {
  return value as Record<string, unknown>;
}

function editableHookOutput(value: unknown) {
  if (typeof value !== "object" || value === null) return value;
  const output = { ...(value as Record<string, unknown>) };
  delete output.selectedHookId;
  return output;
}

function outputError(errors: string[]) {
  return new ContentJobError("INVALID_OUTPUT", errors.join(" "));
}

function applyHookToFirstSlide(copy: CopyOutput, text: string): CopyOutput {
  return {
    ...copy,
    slides: copy.slides.map((slide, index) =>
      index === 0 ? { ...slide, headline: text } : slide,
    ),
  };
}

export class ContentWorkflowService {
  private readonly cwd: string;

  constructor(
    private readonly codex: CodexWorkflowClient,
    readonly registry: ContentJobRegistry,
    options: WorkflowOptions = {},
  ) {
    this.cwd = options.cwd ?? process.cwd();
  }

  async createJob(input: ContentJobInput) {
    const connection = await this.codex.connect();
    if (connection.status !== "connected") {
      throw new ContentJobError(
        "CODEX_UNAVAILABLE",
        "Codex에 연결한 뒤 다시 시도해 주세요.",
      );
    }
    const { threadId } = await this.codex.startThread({
      cwd: this.cwd,
      model: input.model,
    });
    return this.registry.add(input, threadId);
  }

  analyzeReference(id: string, regeneration?: RegenerationRequest) {
    return this.generate(
      id,
      "analyze_reference",
      "reference",
      "draft",
      "analyzing_reference",
      "reviewing_reference",
      referenceAnalysisSchema,
      (job) => {
        const inputs: CodexUserInput[] = [
          { type: "text", text: referenceAnalysisPrompt(job) },
        ];
        for (const image of job.referenceImages) {
          inputs.push({ type: "text", text: `다음 이미지 ID: ${image.id}` });
          inputs.push({ type: "localImage", path: image.path, detail: "high" });
        }
        return inputs;
      },
      (job, output) =>
        validateReferenceOutput(
          output,
          job.referenceImages.map((image) => image.id),
          job.structure,
        ),
      () => true,
      regeneration,
    );
  }

  generateStrategies(id: string, regeneration?: RegenerationRequest) {
    const job = this.registry.getRecord(id);
    return this.generate(
      id,
      "generate_strategies",
      "strategy",
      "reviewing_reference",
      "researching_strategy",
      "reviewing_strategy",
      strategySchema(job.slideCount),
      (current) => [{ type: "text", text: strategyPrompt(current) }],
      (current, output) =>
        validateStrategyOutput(output, current.slideCount, current.structure),
      (current) => current.state.reference.accepted !== null,
      regeneration,
    );
  }

  generateCopy(id: string, regeneration?: RegenerationRequest) {
    const job = this.registry.getRecord(id);
    return this.generate(
      id,
      "generate_copy",
      "copy",
      "reviewing_strategy",
      "drafting_copy",
      "reviewing_copy",
      copySchema(job.slideCount),
      (current) => [{ type: "text", text: copyPrompt(current) }],
      (current, output) => {
        const strategy = current.state.strategy.accepted as
          | (StrategyOutput & { selectedStrategyId: string })
          | null;
        return validateCopyOutput(
          output,
          current.slideCount,
          strategy?.evidence.map((item) => item.id) ?? [],
          current.structure,
        );
      },
      (current) => current.state.strategy.accepted !== null,
      regeneration,
    );
  }

  generateHooks(id: string, regeneration?: RegenerationRequest) {
    return this.generate(
      id,
      "generate_hooks",
      "hooks",
      "reviewing_copy",
      "generating_hooks",
      "reviewing_hooks",
      hookSchema,
      (current) => [{ type: "text", text: hookPrompt(current) }],
      (current, output) => {
        const copy = current.state.copy.accepted as CopyOutput | null;
        return validateHookOutput(
          output,
          copy?.slides.map((slide) => slide.id) ?? [],
        );
      },
      (current) => current.state.copy.accepted !== null,
      regeneration,
    );
  }

  acceptReference(
    id: string,
    value: unknown,
    expectedRevision: number,
  ) {
    const job = this.registry.getRecord(id);
    const result = validateReferenceOutput(
      value,
      job.referenceImages.map((image) => image.id),
      job.structure,
    );
    if (!result.ok) throw outputError(result.errors);
    return this.accept(
      id,
      "reference",
      result.value,
      expectedRevision,
      "reviewing_reference",
    );
  }

  acceptStrategy(
    id: string,
    value: unknown,
    selectedStrategyId: string,
    expectedRevision: number,
  ) {
    const job = this.registry.getRecord(id);
    const result = validateStrategyOutput(value, job.slideCount, job.structure);
    if (!result.ok) throw outputError(result.errors);
    if (!result.value.strategies.some((item) => item.id === selectedStrategyId))
      throw new ContentJobError(
        "INVALID_OUTPUT",
        "선택한 전략을 제안 목록에서 찾을 수 없습니다.",
      );
    return this.accept(
      id,
      "strategy",
      { ...result.value, selectedStrategyId },
      expectedRevision,
      "reviewing_strategy",
    );
  }

  acceptCopy(id: string, value: unknown, expectedRevision: number) {
    const job = this.registry.getRecord(id);
    const strategy = job.state.strategy.accepted as
      | (StrategyOutput & { selectedStrategyId: string })
      | null;
    const result = validateCopyOutput(
      value,
      job.slideCount,
      strategy?.evidence.map((item) => item.id) ?? [],
      job.structure,
    );
    if (!result.ok) throw outputError(result.errors);
    return this.accept(
      id,
      "copy",
      result.value,
      expectedRevision,
      "reviewing_copy",
    );
  }

  acceptHook(
    id: string,
    value: unknown,
    selectedHookId: string,
    expectedRevision: number,
  ) {
    const job = this.registry.getRecord(id);
    const copy = job.state.copy.accepted as CopyOutput | null;
    const result = validateHookOutput(
      value,
      copy?.slides.map((slide) => slide.id) ?? [],
    );
    if (!result.ok) throw outputError(result.errors);
    const selectedHook = result.value.hooks.find((item) => item.id === selectedHookId);
    if (!selectedHook)
      throw new ContentJobError(
        "INVALID_OUTPUT",
        "선택한 훅을 후보 목록에서 찾을 수 없습니다.",
      );
    const accepted = this.accept(
      id,
      "hooks",
      { ...result.value, selectedHookId },
      expectedRevision,
      "reviewing_hooks",
    );
    return this.registry.update(id, (current) => {
      if (current.structure === "repeating" && current.state.copy.accepted) {
        const copy = current.state.copy.accepted as CopyOutput;
        current.state.copy = {
          ...current.state.copy,
          accepted: applyHookToFirstSlide(copy, selectedHook.text),
          revisions: [...current.state.copy.revisions, current.state.copy.accepted],
        };
      }
      current.state = transitionJob(
        current.state,
        "completed",
        accepted.state.revision,
      );
    });
  }

  reviseFinal(
    id: string,
    copyValue: unknown,
    hookValue: unknown,
    selectedHookId: string,
    expectedRevision: number,
  ) {
    const job = this.registry.getRecord(id);
    if (job.state.status !== "completed")
      throw new ContentJobError(
        "INVALID_STAGE",
        "완료된 콘텐츠만 최종 편집할 수 있습니다.",
      );
    const strategy = job.state.strategy.accepted as
      | (StrategyOutput & { selectedStrategyId: string })
      | null;
    const copy = validateCopyOutput(
      copyValue,
      job.slideCount,
      strategy?.evidence.map((item) => item.id) ?? [],
      job.structure,
    );
    if (!copy.ok) throw outputError(copy.errors);
    const hooks = validateHookOutput(
      editableHookOutput(hookValue),
      copy.value.slides.map((slide) => slide.id),
    );
    if (!hooks.ok) throw outputError(hooks.errors);
    const selectedHook = hooks.value.hooks.find((hook) => hook.id === selectedHookId);
    if (!selectedHook)
      throw new ContentJobError(
        "INVALID_OUTPUT",
        "선택한 훅을 후보 목록에서 찾을 수 없습니다.",
      );
    return this.registry.update(id, (current) => {
      const finalCopy = current.structure === "repeating"
        ? applyHookToFirstSlide(copy.value, selectedHook.text)
        : copy.value;
      const withCopy = acceptStage(
        current.state,
        "copy",
        stageRecord(finalCopy),
        expectedRevision,
      );
      current.state = acceptStage(
        withCopy,
        "hooks",
        stageRecord({ ...hooks.value, selectedHookId }),
        withCopy.revision,
      );
      current.lastError = null;
    });
  }

  private accept(
    id: string,
    stage: ContentStage,
    value: object,
    expectedRevision: number,
    requiredStatus: ContentJobStatus,
  ) {
    return this.registry.update(id, (job) => {
      if (job.state.status !== requiredStatus)
        throw new ContentJobError(
          "INVALID_STAGE",
          "현재 단계에서는 이 결과를 승인할 수 없습니다.",
        );
      job.state = acceptStage(
        job.state,
        stage,
        stageRecord(value),
        expectedRevision,
      );
      job.lastError = null;
    });
  }

  private generate<Value extends object>(
    id: string,
    operation: Parameters<ContentJobRegistry["runExclusive"]>[1],
    stage: ContentStage,
    requiredStatus: ContentJobStatus,
    runningStatus: ContentJobStatus,
    reviewStatus: ContentJobStatus,
    outputSchema: StructuredOutputSchema,
    buildInput: (job: ContentJobRecord) => CodexUserInput[],
    validate: (
      job: ContentJobRecord,
      value: unknown,
    ) => { ok: true; value: Value } | { ok: false; errors: string[] },
    prerequisite: (job: ContentJobRecord) => boolean = () => true,
    regeneration?: RegenerationRequest,
  ) {
    return this.registry.runExclusive(id, operation, async (job) => {
      const expectedStatus = regeneration ? reviewStatus : requiredStatus;
      if (job.state.status !== expectedStatus || !prerequisite(job)) {
        throw new ContentJobError(
          "INVALID_STAGE",
          "이전 단계의 승인 결과가 필요합니다.",
        );
      }
      if (regeneration) {
        if (job.state.revision !== regeneration.expectedRevision)
          throw new ContentJobError(
            "INVALID_STAGE",
            "작업 revision이 바뀌었습니다. 최신 결과를 확인해 주세요.",
          );
        const guidance = regeneration.guidance.trim();
        if (!guidance || guidance.length > 2000)
          throw new ContentJobError(
            "INVALID_OUTPUT",
            "수정 요청은 1~2000자로 입력해 주세요.",
          );
        const serializedDraft = JSON.stringify(regeneration.draft);
        if (
          typeof serializedDraft !== "string" ||
          serializedDraft.length > 100_000 ||
          !validateStructuredOutput(outputSchema, regeneration.draft).ok
        )
          throw new ContentJobError(
            "INVALID_OUTPUT",
            "현재 단계의 편집 내용을 확인해 주세요.",
          );
      }
      const before = structuredClone(job.state);
      this.registry.update(id, (current) => {
        current.state = transitionJob(
          current.state,
          runningStatus,
          current.state.revision,
        );
      });
      try {
        const input = buildInput(job);
        if (regeneration) {
          input.push({
            type: "text",
            text: `현재 단계의 사용자 편집 초안:\n${JSON.stringify(regeneration.draft)}\n\n사용자의 수정 요청:\n${regeneration.guidance.trim()}\n\n승인된 이전 단계 결과와 필수 스키마를 유지하면서 이 요청을 반영해 현재 단계의 제안을 새로 작성하세요. 불확실한 사실은 추측하지 말고 확인 필요 항목에 남기세요.`,
          });
        }
        const turn = await this.codex.runStructuredTurn({
          threadId: job.threadId,
          input,
          outputSchema: schemaValue(outputSchema),
        });
        if (turn.status !== "completed") {
          throw new ContentJobError("CODEX_UNAVAILABLE", turn.message);
        }
        const result = validate(job, turn.output);
        if (!result.ok) throw outputError(result.errors);
        return this.registry.update(id, (current) => {
          const proposed = proposeStage(
            current.state,
            stage,
            stageRecord(result.value),
            current.state.revision,
          );
          current.state = transitionJob(
            proposed,
            reviewStatus,
            proposed.revision,
          );
          current.lastError = null;
        });
      } catch (error) {
        this.registry.update(id, (current) => {
          current.state = regeneration
            ? {
                ...before,
                [stage]: {
                  ...before[stage],
                  proposal: regeneration.draft as Record<string, unknown>,
                },
              }
            : before;
        });
        throw error;
      }
    });
  }
}

export type {
  CopyOutput,
  HookOutput,
  ReferenceAnalysisOutput,
  StrategyOutput,
};
