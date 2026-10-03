import type { ContentJobRecord } from "../../../domain/types";
import type { EditorChatTarget } from "../../types";
import { selectedPlacements } from "./chat";

export function targetedChatPrompt(job: ContentJobRecord, target: EditorChatTarget) {
  const document = job.editor.document!;
  const element = document.elements.find((item) => item.id === target.elementId)!;
  const placements = selectedPlacements(document, target);
  return `사용자와는 항상 한국어로 대화하고 reply는 반드시 한국어로 작성하세요. 실제 슬라이드 카피를 새로 만들거나 수정할 때만 ${job.outputLanguage}로 작성하세요. 최종 응답은 지정된 JSON Schema만 따르세요.
이번 요청의 수정 대상은 사용자가 선택한 Element 하나입니다. 다른 Element를 수정하거나 새로 만들지 마세요. 다른 대상을 수정하라는 요청에는 수정값을 모두 비우고 선택을 해제하도록 안내하세요.
선택 대상: ${JSON.stringify({ ...target, name: element.name, kind: element.kind, role: element.role })}
수정 가능한 슬롯: ${JSON.stringify(placements)}
style에서 변경하지 않는 속성은 null로 두세요. frame은 위치나 크기를 바꾸라는 요청일 때만 전체 좌표를 출력하고, 아니면 null로 두세요.
이름이나 역할·의미를 바꾸라는 요청이면 name 또는 role에 새 값을 넣으세요. 그 외에는 null로 두세요. 이름과 역할은 공유 Element 원본에 적용됩니다.
style과 frame의 적용 범위는 앱이 선택된 장 목록으로 결정합니다. slotValues에는 실제 내용을 바꿀 슬롯만 넣으세요. 질문이나 논의만 할 때는 수정값을 모두 비우세요.
intent는 실제 수정이면 edit, 질문이면 answer, 선택 대상을 벗어난 요청이면 unsupported로 지정하세요. edit에는 적어도 한 가지 수정값이 필요하고, answer/unsupported에는 수정값을 넣지 마세요.
배경 Element가 선택되었을 때만 슬라이드 전체 배경을 바꾸세요. 다른 Element가 선택된 경우 '배경색'은 그 Element 상자의 backgroundColor입니다. 배경 Element는 배경색만 변경할 수 있습니다. 이미지 슬롯에는 업로드된 이미지 ID만 사용할 수 있습니다.
변경 전후를 짧게 설명하고, 변경되는 장의 다른 Element와의 배치 충돌 및 텍스트 위계를 확인하세요.
제품 정보: ${JSON.stringify(job.productContext)}
선택한 주제: ${JSON.stringify(job.editor.selectedTopic)}
현재 편집 문서: ${JSON.stringify(document)}
사용할 수 있는 업로드 이미지: ${JSON.stringify(job.assets.map(({ id, name }) => ({ id, name })))}
최근 대화: ${JSON.stringify(job.editor.messages.slice(-12))}
가장 마지막 사용자 메시지에 응답하세요.`;
}
