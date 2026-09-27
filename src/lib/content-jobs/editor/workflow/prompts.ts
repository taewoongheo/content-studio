import type { ContentJobRecord } from "../../domain/types";
import type { EditorChatTarget, EditorProposalTarget, EditorTopic } from "../types";

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

const rules = `최종 응답은 지정된 JSON Schema만 따르세요. 확신할 수 없는 것을 꾸며내지 마세요. 레퍼런스의 문구를 그대로 복사하는 대신 시각적 구조와 표현 규칙을 추출하세요.`;

export function analysisPrompt(job: ContentJobRecord) {
  const roles = job.referenceImages.map((image) => `${image.id}: ${image.role ?? "장면별 구성"}`).join(", ");
  return `${rules}

이미지 레퍼런스로부터 편집 가능한 TikTok 슬라이드쇼의 첫 초안을 만드세요.
구성: ${job.structure}, 총 장수: ${job.slideCount}, 화면 비율: ${job.aspectRatio}, 이미지 역할: ${roles}.
Element는 시각적 레이어와 나중에 내용을 채울 빈 슬롯을 함께 가진 재사용 단위입니다. 지금은 콘텐츠를 기획하거나 카피를 작성하지 마세요. 각 Element의 name은 '훅 제목', '본문 설명 A', 'CTA 문구'처럼 짧은 역할명으로, role은 그 자리에 들어갈 내용의 목적과 조건으로 작성하세요. 제품·운동·주제에 관한 실제 문장, 예시 문구, CTA 카피는 만들지 마세요. 정규화 좌표(0~1), 스타일, 근거 이미지 ID를 정의하세요. 필요하면 rectangle, circle, triangle 도형 Element도 사용하세요.
텍스트가 배경 위에 직접 얹혀 있으면 Element의 backgroundColor를 "transparent"로 지정하세요.
이미지에 가려진 배경이나 원본 사진은 복원할 수 없으므로 새 이미지 Element의 빈 슬롯으로 표현하세요. 원본 스크린샷 전체를 새 슬라이드의 배경으로 사용하지 마세요.
배경 Element는 앱이 모든 장에 자동으로 공유 배치합니다. elements나 elementIds에 배경을 만들거나 넣지 말고 각 대표 장면의 backgroundColor만 분석하세요.
formatNotes에는 레퍼런스의 시각 규칙, 문체, 훅 패턴, 본문 전개 규칙을 구체적으로 요약하세요. 글꼴은 정확한 서체를 단정하지 말고 가까운 계열을 선택하세요.
반복형이면 slides에는 훅·본문·CTA 대표 장면을 하나씩만 넣고, 본문 Element는 앱이 나머지 본문 장에 복제합니다. 장면별 구성이면 slides는 입력 이미지 수 및 요청 슬라이드 수와 같아야 합니다.
각 장에는 적어도 하나의 텍스트 Element를 포함하세요.
결과 언어: ${job.outputLanguage}.`;
}

export function topicsPrompt(job: ContentJobRecord, guidance = "") {
  return `${rules}

현재 편집 문서의 시각 포맷에 맞는 서로 다른 주제 3개를 제안하세요. 필요하다면 인터넷에서 사실과 최신 맥락을 조사하고 출처 URL을 넣으세요. 주제는 제품 정보와 시각 슬롯에 실제로 들어갈 수 있어야 합니다.
대화용 message와 각 주제의 rationale은 항상 한국어로 작성하세요. 주제의 title과 angle은 콘텐츠 결과물이므로 ${job.outputLanguage}로 작성하세요.
사용자의 추가 요청: ${guidance || "없음"}
제품 정보: ${json(job.productContext)}
편집 문서: ${json(job.editor.document)}
대화: ${json(job.editor.messages.slice(-12))}`;
}

export function bodyPrompt(job: ContentJobRecord, topic: EditorTopic) {
  return `${rules}

선택한 주제로 전체 본문 흐름을 먼저 구성한 다음, 훅을 제외한 모든 텍스트 Element 슬롯에 내용을 채우세요. slotValues에는 해당 슬롯을 정확히 한 번씩 포함하세요. 슬라이드 ID와 배치 ID는 편집 문서의 값을 그대로 사용하세요. 시각적 반복 형식을 유지하되 장마다 다른 정보를 전개하세요. 이미지 슬롯은 여기서 채우지 않습니다. 사실 주장은 제품 정보 또는 주제 근거가 뒷받침하는 수준으로 제한하세요.
대화용 message는 항상 한국어로 작성하고, slotValues의 실제 슬라이드 카피만 ${job.outputLanguage}로 작성하세요.
선택한 주제: ${json(topic)}
제품 정보: ${json(job.productContext)}
편집 문서: ${json(job.editor.document)}`;
}

export function hooksPrompt(job: ContentJobRecord, guidance = "") {
  return `${rules}

본문이 실제로 뒷받침하는 서로 다른 훅 후보 4개를 제안하세요. 레퍼런스의 훅 구조를 활용하되 문장을 그대로 복사하지 마세요.
대화용 message와 각 후보의 rationale은 항상 한국어로 작성하고, hooks의 text만 콘텐츠 결과물이므로 ${job.outputLanguage}로 작성하세요.
사용자의 추가 요청: ${guidance || "없음"}
선택한 주제: ${json(job.editor.selectedTopic)}
편집 문서: ${json(job.editor.document)}
최근 대화: ${json(job.editor.messages.slice(-12))}`;
}

export function chatPrompt(job: ContentJobRecord) {
  return `${rules}

사용자와는 항상 한국어로 대화하세요. reply는 질문 답변과 변경 설명을 포함해 반드시 한국어로 작성하세요. 새로 만들거나 수정하는 실제 슬라이드 카피만 ${job.outputLanguage}로 작성하세요. 슬라이드를 직접 수정해야 하는 요청이면 JSON의 수정 배열에 필요한 변경만 넣으세요. 단순 질문에는 수정 배열을 모두 비워두세요. 사용자가 손으로 고친 다른 슬롯을 다시 쓰지 마세요. Element는 레이어와 콘텐츠 슬롯을 함께 가진 단위입니다. 새 Element를 만들면 필요한 슬라이드에 배치하세요. 변경 전후를 짧게 설명하세요.
수정 명령을 정한 뒤 변경되는 슬라이드의 모든 Element를 다시 함께 검토해 의미 중복, 텍스트 위계, 배치 충돌과 앞뒤 장면의 연결을 확인하세요.
배경은 모든 장이 공유하는 삭제 불가 Element입니다. 일부 장의 배경색 변경은 backgroundUpdates에 넣고, 모든 장의 배경색 변경은 backgroundColorAll에 색상을 넣으세요. 전체 변경이 없으면 backgroundColorAll은 null로 두세요.
제품 정보: ${json(job.productContext)}
선택한 주제: ${json(job.editor.selectedTopic)}
현재 편집 문서: ${json(job.editor.document)}
사용할 수 있는 업로드 이미지: ${json(job.assets.map(({ id, name }) => ({ id, name })))}
최근 대화: ${json(job.editor.messages.slice(-12))}
가장 마지막 사용자 메시지에 응답하세요.`;
}

export function topicRevisionPrompt(job: ContentJobRecord, topic: EditorTopic, guidance: string) {
  return `${rules}

선택한 주제 후보 하나만 수정하세요. 게시글 본문은 아직 변경하지 않습니다.
message와 rationale은 한국어로, title과 angle은 ${job.outputLanguage}로 작성하세요.
기존 후보: ${json(topic)}
수정 요청: ${guidance}
제품 정보: ${json(job.productContext)}
편집 문서: ${json(job.editor.document)}`;
}

export function hookRevisionPrompt(job: ContentJobRecord, hook: { text: string; rationale: string }, guidance: string) {
  return `${rules}

선택한 훅 후보 하나만 수정하세요. 첫 슬라이드는 아직 변경하지 않습니다.
message와 rationale은 한국어로, hook.text는 ${job.outputLanguage}로 작성하세요.
기존 후보: ${json(hook)}
수정 요청: ${guidance}
선택한 주제: ${json(job.editor.selectedTopic)}
편집 문서: ${json(job.editor.document)}`;
}

export function answerPrompt(job: ContentJobRecord, elementTarget: EditorChatTarget | null,
  proposalTarget: EditorProposalTarget | null) {
  const proposalSet = job.editor.proposalSets.find((set) => set.id === proposalTarget?.setId);
  const proposal = proposalSet?.items.find((item) => item.id === proposalTarget?.candidateId);
  return `${rules}

사용자의 마지막 질문에 한국어로 간결하게 답하세요. 문서는 수정하지 않습니다.
현재 채팅은 주제·훅 제안과 적용, 슬라이드 카피·Element 수정, 되돌리기를 실행할 수 있습니다. 이미지 생성과 로컬 이미지 풀 검색·자동 삽입은 아직 연결되지 않았습니다. 실행하지 않은 작업을 완료했다고 말하지 마세요.
선택한 Element: ${json(elementTarget)}
선택한 제안: ${json(proposal ?? null)}
제품 정보: ${json(job.productContext)}
선택한 주제: ${json(job.editor.selectedTopic)}
편집 문서: ${json(job.editor.document)}
최근 대화: ${json(job.editor.messages.slice(-12))}`;
}

export function directTopicPrompt(job: ContentJobRecord, guidance: string) {
  return `${rules}

사용자 요청에 맞는 주제 하나를 작성하세요. 이 주제로 다음 단계에서 본문을 채웁니다.
message와 rationale은 한국어로, title과 angle은 ${job.outputLanguage}로 작성하세요.
필요한 사실은 조사하고 확인한 출처 URL만 넣으세요. 확인하지 못한 URL은 만들지 마세요.
사용자 요청: ${guidance}
제품 정보: ${json(job.productContext)}
편집 문서: ${json(job.editor.document)}`;
}

export function directHookPrompt(job: ContentJobRecord, guidance: string) {
  return `${rules}

현재 본문에 실제로 맞는 훅 하나를 작성하세요. 결과를 첫 슬라이드에 바로 적용합니다.
message와 rationale은 한국어로, hook.text는 ${job.outputLanguage}로 작성하세요.
사용자 요청: ${guidance}
선택한 주제: ${json(job.editor.selectedTopic)}
편집 문서: ${json(job.editor.document)}`;
}
