import assert from "node:assert/strict";
import test from "node:test";
import type {
  CodexJsonValue,
  StructuredTurnResult,
} from "../../codex/transport/types";
import { ContentJobRegistry } from "./registry";
import { ContentWorkflowService } from "./workflow";
import type { ContentJobInput } from "../domain/types";

const jobInput: ContentJobInput = {
  productContext: {
    name: "LiftCode",
    description: "운동 기록 앱",
    audience: "근력 운동 사용자",
    constraints: "과장 금지",
  },
  aspectRatio: "9:16",
  slideCount: 2,
  outputLanguage: "한국어",
  referenceImages: [
    {
      id: "image-1",
      name: "one.png",
      path: "/tmp/one.png",
      type: "image/png",
      size: 100,
    },
    {
      id: "image-2",
      name: "two.png",
      path: "/tmp/two.png",
      type: "image/png",
      size: 100,
    },
  ],
};

const referenceOutput = {
  sourceLanguage: "en",
  outputLanguage: "ko",
  visualLanguage: {
    summary: "큰 제목",
    imageIds: ["image-1", "image-2"],
  },
  slides: [
    {
      imageId: "image-1",
      role: "훅",
      transitionFromPrevious: "시작",
    },
    {
      imageId: "image-2",
      role: "설명",
      transitionFromPrevious: "대조",
    },
  ],
  writingStyle: { summary: "짧은 문장", imageIds: ["image-1"] },
  textDensity: { summary: "두 문장", imageIds: ["image-2"] },
  hook: {
    originalText: "Stop guessing",
    pattern: "금지형",
    imageIds: ["image-1"],
  },
  uncertainties: [],
};

const strategyOutput = {
  evidence: [
    {
      id: "evidence-1",
      url: "https://example.com/source",
      title: "출처",
      summary: "근거",
    },
  ],
  strategies: Array.from({ length: 3 }, (_, strategyIndex) => ({
    id: `strategy-${strategyIndex + 1}`,
    topic: `주제 ${strategyIndex + 1}`,
    angle: `각도 ${strategyIndex + 1}`,
    referenceFit: "레퍼런스와 맞음",
    slidePlan: Array.from({ length: 2 }, (_, slideIndex) => ({
      id: `strategy-${strategyIndex + 1}-slide-${slideIndex + 1}`,
      role: slideIndex === 0 ? "문제" : "해결",
      productFact: "제품 정보",
      evidenceIds: ["evidence-1"],
    })),
    warnings: [],
  })),
  missingInformation: [],
};

const copyOutput = {
  slides: Array.from({ length: 2 }, (_, index) => ({
    id: `slide-${index + 1}`,
    role: index === 0 ? "문제" : "해결",
    headline: `제목 ${index + 1}`,
    body: `본문 ${index + 1}`,
    visualDirection: "텍스트 중심",
    transitionFromPrevious: index === 0 ? "시작" : "해결로 전환",
    claimReferences: ["product-context", "evidence-1"],
  })),
  uncertainties: [],
};

const hookOutput = {
  hooks: Array.from({ length: 4 }, (_, index) => ({
    id: `hook-${index + 1}`,
    text: `훅 문구 ${index + 1}`,
    pattern: "대조형",
    angle: `각도 ${index + 1}`,
    supportingSlideIds: ["slide-1", "slide-2"],
  })),
  warnings: [],
};

class FakeCodexClient {
  nextThread = 0;
  startedThreads: string[] = [];
  turnThreadIds: string[] = [];
  outputs: CodexJsonValue[] = [];
  pendingTurn: Promise<StructuredTurnResult> | null = null;

  async connect() {
    return { status: "connected" as const, message: "연결됨" };
  }

  async startThread() {
    const threadId = `thread-${++this.nextThread}`;
    this.startedThreads.push(threadId);
    return { threadId };
  }

  async runStructuredTurn({ threadId }: { threadId: string }) {
    this.turnThreadIds.push(threadId);
    if (this.pendingTurn) return this.pendingTurn;
    const output = this.outputs.shift();
    assert.notEqual(output, undefined);
    return {
      status: "completed" as const,
      threadId,
      turnId: `turn-${this.turnThreadIds.length}`,
      output: output!,
    };
  }
}

function createService(codex = new FakeCodexClient()) {
  let nextId = 0;
  const registry = new ContentJobRegistry({
    createId: () => `job-${++nextId}`,
    now: () => new Date("2026-09-22T00:00:00.000Z"),
  });
  return {
    codex,
    service: new ContentWorkflowService(codex, registry, { cwd: "/project" }),
  };
}

test("each job gets one thread and all four stages reuse it", async () => {
  const { codex, service } = createService();
  codex.outputs.push(
    referenceOutput,
    strategyOutput,
    copyOutput,
    hookOutput,
  );
  let job = await service.createJob(jobInput);

  job = await service.analyzeReference(job.id);
  job = service.acceptReference(
    job.id,
    job.state.reference.proposal,
    job.state.revision,
  );
  job = await service.generateStrategies(job.id);
  job = service.acceptStrategy(
    job.id,
    job.state.strategy.proposal,
    "strategy-1",
    job.state.revision,
  );
  job = await service.generateCopy(job.id);
  job = service.acceptCopy(
    job.id,
    job.state.copy.proposal,
    job.state.revision,
  );
  job = await service.generateHooks(job.id);
  job = service.acceptHook(
    job.id,
    job.state.hooks.proposal,
    "hook-1",
    job.state.revision,
  );

  assert.equal(job.state.status, "completed");
  const revisionBeforeFinalEdit = job.state.revision;
  const editedCopy = structuredClone(copyOutput);
  editedCopy.slides[0].headline = "수정한 제목";
  const editedHooks = {
    ...structuredClone(hookOutput),
    selectedHookId: "hook-1",
  };
  editedHooks.hooks[0].text = "수정한 훅";
  job = service.reviseFinal(
    job.id,
    editedCopy,
    editedHooks,
    "hook-1",
    revisionBeforeFinalEdit,
  );
  assert.equal(job.state.status, "completed");
  assert.equal(job.state.revision, revisionBeforeFinalEdit + 2);
  assert.equal(
    (job.state.copy.accepted as typeof copyOutput).slides[0].headline,
    "수정한 제목",
  );
  assert.deepEqual(codex.startedThreads, ["thread-1"]);
  assert.deepEqual(codex.turnThreadIds, [
    "thread-1",
    "thread-1",
    "thread-1",
    "thread-1",
  ]);
  assert.equal(JSON.stringify(job).includes("/tmp/one.png"), false);
});

test("different jobs receive different threads", async () => {
  const { codex, service } = createService();
  await service.createJob(jobInput);
  await service.createJob(jobInput);
  assert.deepEqual(codex.startedThreads, ["thread-1", "thread-2"]);
});

test("invalid output restores the reviewable state and can be retried", async () => {
  const { codex, service } = createService();
  codex.outputs.push({ wrong: true }, referenceOutput);
  const created = await service.createJob(jobInput);

  await assert.rejects(
    service.analyzeReference(created.id),
    /필수 속성|must have required property/,
  );
  let job = service.registry.get(created.id);
  assert.equal(job.state.status, "draft");
  assert.equal(job.activeOperation, null);
  assert.ok(job.lastError);

  job = await service.analyzeReference(created.id);
  assert.equal(job.state.status, "reviewing_reference");
  assert.equal(job.lastError, null);
});

test("a second turn for the same job is rejected while one is active", async () => {
  const { codex, service } = createService();
  let resolveTurn!: (result: StructuredTurnResult) => void;
  codex.pendingTurn = new Promise((resolve) => {
    resolveTurn = resolve;
  });
  const job = await service.createJob(jobInput);
  const first = service.analyzeReference(job.id);

  await assert.rejects(
    service.analyzeReference(job.id),
    /다른 AI 생성이 진행 중/,
  );
  resolveTurn({
    status: "completed",
    threadId: "thread-1",
    turnId: "turn-1",
    output: referenceOutput,
  });
  assert.equal((await first).state.status, "reviewing_reference");
});
