import type { ContentJobRecord } from "../../../domain/types";
import type { EditorChatTarget, EditorDocument } from "../../types";

export type ElementChoice = {
  reply: string;
  kind: "text" | "rectangle" | "circle" | "triangle";
  slideId: string;
  name: string;
  role: string;
  value: string;
};

export function elementChoiceSchema(document: EditorDocument) {
  return {
    type: "object",
    properties: {
      reply: { type: "string" },
      kind: { type: "string", enum: ["text", "rectangle", "circle", "triangle"] },
      slideId: { type: "string", enum: document.slides.map((slide) => slide.id) },
      name: { type: "string" },
      role: { type: "string" },
      value: { type: "string" },
    },
    required: ["reply", "kind", "slideId", "name", "role", "value"],
    additionalProperties: false,
  };
}

export function elementChoicePrompt(job: ContentJobRecord, target: EditorChatTarget | null) {
  return `사용자의 요청에 맞는 새 텍스트 또는 도형 Element 하나를 정의하세요. 지정된 JSON Schema만 반환하세요.
reply는 한국어로, 실제 슬라이드 카피만 ${job.outputLanguage}로 작성하세요. name은 짧은 역할명, role은 Element의 의미를 설명하세요.
텍스트 내용을 요청했다면 value에 실제 카피를 넣고, 아직 내용을 정하지 않았다면 빈 문자열로 두세요. 도형의 value는 항상 빈 문자열입니다.
선택된 장을 기본 대상으로 사용하되 사용자가 다른 장을 명시했다면 해당 장을 선택하세요.
선택된 Element: ${JSON.stringify(target)}
슬라이드: ${JSON.stringify(job.editor.document?.slides.map(({ id, role }) => ({ id, role })))}
마지막 사용자 요청: ${job.editor.messages.at(-1)?.text ?? ""}`;
}
