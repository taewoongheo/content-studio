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
    const { threadId } = await this.codex.startThread({ cwd: this.cwd });
    return this.registry.add(input, threadId);
  }

  analyzeReference(id: string) {
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
        ),
    );
  }

  generateStrategies(id: string) {
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
        validateStrategyOutput(output, current.slideCount),
      (current) => current.state.reference.accepted !== null,
    );
  }

  generateCopy(id: string) {
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
        );
      },
      (current) => current.state.strategy.accepted !== null,
    );
  }

  generateHooks(id: string) {
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
    const result = validateStrategyOutput(value, job.slideCount);
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
    if (!result.value.hooks.some((item) => item.id === selectedHookId))
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
    );
    if (!copy.ok) throw outputError(copy.errors);
    const hooks = validateHookOutput(
      editableHookOutput(hookValue),
      copy.value.slides.map((slide) => slide.id),
    );
    if (!hooks.ok) throw outputError(hooks.errors);
    if (!hooks.value.hooks.some((hook) => hook.id === selectedHookId))
      throw new ContentJobError(
        "INVALID_OUTPUT",
        "선택한 훅을 후보 목록에서 찾을 수 없습니다.",
      );
    return this.registry.update(id, (current) => {
      const withCopy = acceptStage(
        current.state,
        "copy",
        stageRecord(copy.value),
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
  ) {
    return this.registry.runExclusive(id, operation, async (job) => {
      if (job.state.status !== requiredStatus || !prerequisite(job)) {
        throw new ContentJobError(
          "INVALID_STAGE",
          "이전 단계의 승인 결과가 필요합니다.",
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
        const turn = await this.codex.runStructuredTurn({
          threadId: job.threadId,
          input: buildInput(job),
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
          current.state = before;
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
