export const contentJobStatuses = [
  "draft",
  "analyzing_reference",
  "reviewing_reference",
  "researching_strategy",
  "reviewing_strategy",
  "drafting_copy",
  "reviewing_copy",
  "generating_hooks",
  "reviewing_hooks",
  "completed",
  "failed",
] as const;

export type ContentJobStatus = (typeof contentJobStatuses)[number];
export type ContentStage = "reference" | "strategy" | "copy" | "hooks";
type StageValue = Record<string, unknown>;

export type StageResult = {
  proposal: StageValue | null;
  accepted: StageValue | null;
  revisions: StageValue[];
};

export type ContentJobState = {
  status: ContentJobStatus;
  revision: number;
  reference: StageResult;
  strategy: StageResult;
  copy: StageResult;
  hooks: StageResult;
};

export type ContentJobDomainErrorCode =
  | "INVALID_TRANSITION"
  | "REVISION_CONFLICT";

export class ContentJobDomainError extends Error {
  constructor(
    readonly code: ContentJobDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ContentJobDomainError";
  }
}

const emptyStage = (): StageResult => ({
  proposal: null,
  accepted: null,
  revisions: [],
});

const nextStatus: Partial<Record<ContentJobStatus, ContentJobStatus>> = {
  draft: "analyzing_reference",
  analyzing_reference: "reviewing_reference",
  reviewing_reference: "researching_strategy",
  researching_strategy: "reviewing_strategy",
  reviewing_strategy: "drafting_copy",
  drafting_copy: "reviewing_copy",
  reviewing_copy: "generating_hooks",
  generating_hooks: "reviewing_hooks",
  reviewing_hooks: "completed",
};

function assertRevision(state: ContentJobState, expectedRevision: number) {
  if (state.revision !== expectedRevision) {
    throw new ContentJobDomainError(
      "REVISION_CONFLICT",
      `현재 revision은 ${state.revision}이지만 ${expectedRevision}이 요청되었습니다.`,
    );
  }
}

export function createContentJobState(): ContentJobState {
  return {
    status: "draft",
    revision: 0,
    reference: emptyStage(),
    strategy: emptyStage(),
    copy: emptyStage(),
    hooks: emptyStage(),
  };
}

export function transitionJob(
  state: ContentJobState,
  status: ContentJobStatus,
  expectedRevision: number,
): ContentJobState {
  assertRevision(state, expectedRevision);
  const isFailure = status === "failed" && state.status !== "completed";
  if (nextStatus[state.status] !== status && !isFailure) {
    throw new ContentJobDomainError(
      "INVALID_TRANSITION",
      `${state.status}에서 ${status}(으)로 이동할 수 없습니다.`,
    );
  }
  return { ...state, status, revision: state.revision + 1 };
}

export function proposeStage(
  state: ContentJobState,
  stage: ContentStage,
  proposal: StageValue,
  expectedRevision: number,
): ContentJobState {
  assertRevision(state, expectedRevision);
  return {
    ...state,
    [stage]: { ...state[stage], proposal },
    revision: state.revision + 1,
  };
}

export function acceptStage(
  state: ContentJobState,
  stage: ContentStage,
  accepted: StageValue,
  expectedRevision: number,
): ContentJobState {
  assertRevision(state, expectedRevision);
  const current = state[stage];
  const revisedStage: StageResult = {
    ...current,
    accepted,
    revisions:
      current.accepted === null
        ? current.revisions
        : [...current.revisions, current.accepted],
  };
  const next: ContentJobState = {
    ...state,
    [stage]: revisedStage,
    revision: state.revision + 1,
  };
  const invalidated: Record<ContentStage, ContentStage[]> = {
    reference: ["strategy", "copy", "hooks"],
    strategy: ["copy", "hooks"],
    copy: ["hooks"],
    hooks: [],
  };
  for (const downstream of invalidated[stage]) next[downstream] = emptyStage();
  return next;
}

export const reviseStage = acceptStage;
