import assert from "node:assert/strict";
import test from "node:test";
import {
  acceptStage,
  ContentJobDomainError,
  createContentJobState,
  proposeStage,
  reviseStage,
  transitionJob,
} from "./domain";

test("작업은 정의된 다음 상태로만 이동한다", () => {
  let job = createContentJobState();
  const path = [
    "analyzing_reference",
    "reviewing_reference",
    "researching_strategy",
    "reviewing_strategy",
    "drafting_copy",
    "reviewing_copy",
    "generating_hooks",
    "reviewing_hooks",
    "completed",
  ] as const;

  for (const status of path) {
    job = transitionJob(job, status, job.revision);
  }

  assert.equal(job.status, "completed");
  assert.equal(job.revision, path.length);
});

test("중간 단계를 건너뛰거나 오래된 revision으로 변경할 수 없다", () => {
  const job = createContentJobState();

  assert.throws(
    () => transitionJob(job, "researching_strategy", job.revision),
    (error: unknown) =>
      error instanceof ContentJobDomainError &&
      error.code === "INVALID_TRANSITION",
  );

  assert.throws(
    () => transitionJob(job, "analyzing_reference", 3),
    (error: unknown) =>
      error instanceof ContentJobDomainError && error.code === "REVISION_CONFLICT",
  );
});

test("상위 단계 수정은 하위 결과만 무효화하고 이력을 남긴다", () => {
  const initial = {
    ...createContentJobState(),
    revision: 7,
    reference: {
      proposal: { language: "en" },
      proposalHistory: [],
      accepted: { language: "en" },
      revisions: [],
    },
    strategy: {
      proposal: { id: "strategy-1" },
      proposalHistory: [],
      accepted: { id: "strategy-1" },
      revisions: [],
    },
    copy: {
      proposal: { slides: 5 },
      proposalHistory: [],
      accepted: { slides: 5 },
      revisions: [],
    },
    hooks: {
      proposal: { count: 4 },
      proposalHistory: [],
      accepted: { count: 4 },
      revisions: [],
    },
  };

  const revised = reviseStage(
    initial,
    "strategy",
    { id: "strategy-2" },
    initial.revision,
  );

  assert.equal(revised.revision, 8);
  assert.deepEqual(revised.strategy.accepted, { id: "strategy-2" });
  assert.deepEqual(revised.strategy.revisions, [{ id: "strategy-1" }]);
  assert.equal(revised.reference.accepted?.language, "en");
  assert.equal(revised.copy.proposal, null);
  assert.equal(revised.copy.accepted, null);
  assert.equal(revised.hooks.proposal, null);
  assert.equal(revised.hooks.accepted, null);
});

test("AI 제안값과 사용자 승인값을 분리한다", () => {
  const initial = createContentJobState();
  const proposed = proposeStage(
    initial,
    "reference",
    { language: "en" },
    initial.revision,
  );

  assert.deepEqual(proposed.reference.proposal, { language: "en" });
  assert.equal(proposed.reference.accepted, null);

  const accepted = acceptStage(
    proposed,
    "reference",
    { language: "ko" },
    proposed.revision,
  );
  assert.deepEqual(accepted.reference.proposal, { language: "en" });
  assert.deepEqual(accepted.reference.accepted, { language: "ko" });
  assert.deepEqual(accepted.reference.revisions, []);
});

test("검토 중 재생성은 같은 단계로 돌아오고 이전 제안을 보관한다", () => {
  let state = createContentJobState();
  state = transitionJob(state, "analyzing_reference", state.revision);
  state = proposeStage(state, "reference", { summary: "처음" }, state.revision);
  state = transitionJob(state, "reviewing_reference", state.revision);
  state = transitionJob(state, "analyzing_reference", state.revision);
  state = proposeStage(state, "reference", { summary: "다시" }, state.revision);
  state = transitionJob(state, "reviewing_reference", state.revision);
  assert.deepEqual(state.reference.proposal, { summary: "다시" });
  assert.deepEqual(state.reference.proposalHistory, [{ summary: "처음" }]);
  assert.equal(state.reference.accepted, null);
});
