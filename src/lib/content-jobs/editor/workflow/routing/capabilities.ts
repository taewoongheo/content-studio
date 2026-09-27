/** Actions that AI chat may request. Each action is still validated by its executor. */
export const CHAT_CAPABILITIES = {
  answer: { effect: "none", description: "질문에 답하거나 현재 문서를 설명한다." },
  propose_topics: { effect: "proposal", description: "새 주제 후보 세 개를 제안하거나 전체를 다시 추천한다." },
  revise_topic: { effect: "proposal", description: "기존 주제 후보 하나를 수정한다." },
  apply_topic: { effect: "document", description: "지정한 주제로 본문을 작성해 게시글에 적용한다." },
  draft_topic: { effect: "document", description: "주제 하나를 만들고 바로 본문을 작성해 적용한다." },
  propose_hooks: { effect: "proposal", description: "현재 본문에 맞는 새 훅 후보 네 개를 제안한다." },
  revise_hook: { effect: "proposal", description: "기존 훅 후보 하나를 수정한다." },
  apply_hook: { effect: "document", description: "지정한 훅 후보를 첫 슬라이드에 적용한다." },
  write_hook: { effect: "document", description: "훅 하나를 작성해 바로 첫 슬라이드에 적용한다." },
  edit_document: { effect: "document", description: "카피, Element, 위치, 크기 또는 스타일을 직접 수정한다." },
  undo: { effect: "document", description: "마지막 문서 변경을 되돌린다." },
} as const;

export type ChatCapability = keyof typeof CHAT_CAPABILITIES;
