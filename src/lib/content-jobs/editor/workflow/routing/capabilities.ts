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
  edit_document: { effect: "document", description: "선택한 Element의 내용, 이름, 역할, 위치, 크기 또는 스타일을 수정한다." },
  add_element: { effect: "document", description: "텍스트 또는 도형 Element를 새로 만든다." },
  remove_element: { effect: "document", description: "선택한 Element를 선택된 장에서 제거한다." },
  duplicate_element: { effect: "document", description: "선택한 Element를 선택된 장에 복제한다." },
  add_image: { effect: "document", description: "저장된 이미지 에셋을 찾아 새 이미지 Element로 삽입한다." },
  replace_image: { effect: "document", description: "선택한 이미지 Element의 내용을 저장된 이미지 에셋으로 교체한다." },
  edit_image: { effect: "document", description: "선택한 이미지 Element의 위치, 크기 또는 스타일을 수정한다." },
  add_slide: { effect: "document", description: "현재 장 뒤에 내용이 비어 있는 슬라이드를 추가한다." },
  duplicate_slide: { effect: "document", description: "현재 슬라이드를 내용과 함께 복제한다." },
  remove_slide: { effect: "document", description: "현재 슬라이드를 제거한다." },
  undo: { effect: "document", description: "마지막 문서 변경을 되돌린다." },
} as const;

export type ChatCapability = keyof typeof CHAT_CAPABILITIES;
