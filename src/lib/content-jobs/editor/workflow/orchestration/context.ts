import type { StoredAsset } from "@/lib/local-db/assets";
import type { ContentJobRecord } from "../../../domain/types";
import type { EditorChatTarget } from "../../types";
import type { SelectedProposal } from "../proposals/lifecycle";
import type { AgentActionResult } from "./output-schema";

function compactDocument(job: ContentJobRecord) {
  const document = job.editor.document!;
  return {
    structure: document.structure,
    aspectRatio: document.aspectRatio,
    formatNotes: document.formatNotes,
    elements: document.elements.map(({ id, name, role, kind, frame, style }) =>
      ({ id, name, role, kind, frame, style })),
    slides: document.slides.map(({ id, role, backgroundColor, placements }) => ({
      id, role, backgroundColor,
      placements: placements.map(({ id, elementId, value, frameOverride, styleOverride }) =>
        ({ id, elementId, value, frameOverride, styleOverride })),
    })),
  };
}

export function agentContext(job: ContentJobRecord, target: EditorChatTarget | null,
  selectedProposal: SelectedProposal, assets: StoredAsset[], results: AgentActionResult[]) {
  const latestUser = job.editor.messages.findLast((message) => message.role === "user");
  return {
    request: latestUser?.text ?? "",
    outputLanguage: job.outputLanguage,
    product: job.productContext,
    selectedElement: target,
    selectedProposal,
    selectedTopic: job.editor.selectedTopic,
    bodyReady: job.editor.bodyReady,
    recentConversation: job.editor.messages.filter((message) => !message.execution).slice(0, -1).slice(-6)
      .map(({ role, text, proposalLabel }) => ({ role, text: text.slice(0, 2000), proposalLabel })),
    document: compactDocument(job),
    availableAssets: assets.map(({ id, name, description }) => ({ id, name, description })),
    actionResults: results,
  };
}

export function agentPrompt(job: ContentJobRecord, target: EditorChatTarget | null,
  selectedProposal: SelectedProposal, assets: StoredAsset[], results: AgentActionResult[]) {
  return `당신은 슬라이드 편집기의 계획자입니다. 사용자의 최신 요청과 대화 문맥을 자유롭게 해석하되,
파일·DB·문서를 직접 수정하지 말고 지정된 JSON만 반환하세요. 사용자에게 보여주는 reply와 rationale은 한국어로,
슬라이드 카피 및 후보의 title/angle/text는 ${job.outputLanguage}로 작성하세요.

status 규칙:
- complete: 지금 가진 정보로 답변, 제안, 문서 명령 또는 undo를 최종 제출합니다.
- actions: 추가 정보가 실제로 필요할 때만 search_assets 또는 inspect_assets를 요청합니다.
- ask_user: 합리적인 기본값으로 진행할 수 없고 사용자만 답할 수 있는 정보가 필요할 때만 질문합니다.
신뢰도가 낮다는 이유만으로 제안과 적용 중 무엇인지 되묻지 마세요. 최신 요청과 앞 대화를 함께 해석하세요.

actions일 때 actions만 채우고 topics/hooks/commands는 빈 배열, appliedProposalId는 빈 문자열, history는 none입니다.
search_assets는 저장된 이미지의 이름·설명을 검색하며 여러 검색어를 한 액션에 묶습니다.
inspect_assets는 availableAssets에 있는 ID만 최대 4개 요청합니다. 검색 없이 답할 수 있으면 액션을 요청하지 마세요.
이미지 생성 API는 아직 없습니다. 생성했다고 말하거나 임의 asset ID를 만들지 마세요.

complete일 때 actions는 빈 배열입니다. 일반 질문은 reply만 작성하고 나머지는 비웁니다.
주제나 훅 후보를 요청하면 topics 또는 hooks에 최대 8개를 반환합니다. 후보 클릭은 선택일 뿐이므로,
사용자가 명시적으로 적용하라고 한 경우에만 appliedProposalId와 commands를 함께 반환합니다.
선택 후보를 다듬으라는 요청은 selectedProposal을 바탕으로 새 후보를 반환하고 문서는 건드리지 않습니다.
새 후보를 만들고 바로 적용하라는 요청은 후보와 명령을 함께 반환할 수 있습니다.
undo는 history를 undo로 하고 다른 결과를 모두 비웁니다.

사용자의 최신 요청과 대화 문맥이 작업 범위를 결정하는 최우선 기준입니다.
selectedElement는 현재 UI 선택 상태이며 권한 경계가 아닙니다. 요청이 '이 Element', '선택한 제목'처럼 모호하게 대상을
가리킬 때 우선 대상으로 사용하세요. 요청을 수행하려면 Element를 분할·추가하거나 다른 Element와 슬라이드까지 수정해야 하는 경우
필요한 범위를 함께 변경할 수 있습니다. 사용자가 명시한 대상이나 범위가 selectedElement와 다르면 사용자 요청을 따르세요.
변경하지 않는 optional command 필드는 null로 둡니다.
좌표는 슬라이드 너비·높이를 1로 보는 정규화 좌표입니다. x·y는 음수나 1 초과, width·height는 1 초과도 가능하므로
사용자가 요청하면 Element를 슬라이드 바깥으로 이동하거나 확장할 수 있습니다. 기존 레이아웃과 공유 Element 구조를 유지하세요.
새 Element, Placement, Slide ID에는 응답 안에서 일관된 임시 ID를 사용하세요. 앱이 실제 ID를 발급합니다.
이미지 슬롯에는 availableAssets 또는 이미 업로드된 asset ID만 넣으세요. 에셋이 없으면 슬롯을 비워 둡니다.
근거 URL을 꾸며내지 마세요. 내용 작성 후 전체 슬라이드의 의미와 전개를 확인하세요.

현재 문맥: ${JSON.stringify(agentContext(job, target, selectedProposal, assets, results))}`;
}

export function agentContinuationPrompt(results: AgentActionResult[]) {
  return `앱이 요청한 조회 액션을 실행했습니다. 아래 결과만 새 정보이며, 이전 사용자 요청과 문서 문맥은 같은 thread에 유지됩니다.
결과를 바탕으로 다음 조회가 꼭 필요하면 status=actions, 최종 답변이나 편집안을 만들 수 있으면 status=complete를 반환하세요.
이미 받은 것과 같은 조회를 반복하지 마세요. 액션 결과: ${JSON.stringify(results)}`;
}
