import type { CodexConnectionManager } from "../../../../codex/connection/connection";
import type { CodexJsonValue } from "../../../../codex/transport/types";
import type { ContentJobRecord } from "../../../domain/types";
import { validateStructuredOutput } from "../../../structured-output/schemas";
import type { EditorChatTarget, EditorProposalTarget } from "../../types";
import { CHAT_CAPABILITIES, type ChatCapability } from "./capabilities";

export type ChatRoute = {
  capability: ChatCapability;
  proposalSetId: string;
  candidateId: string;
};

export type ChatRouteInput = {
  job: ContentJobRecord;
  message: string;
  elementTarget: EditorChatTarget | null;
  proposalTarget: EditorProposalTarget | null;
};

export interface ChatRouter {
  route(input: ChatRouteInput): Promise<ChatRoute>;
}

export class CodexChatRouter implements ChatRouter {
  constructor(private readonly codex: Pick<CodexConnectionManager, "runStructuredTurn">) {}

  async route({ job, message, elementTarget, proposalTarget }: ChatRouteInput): Promise<ChatRoute> {
    const recentSets = job.editor.proposalSets.slice(-6);
    const selectedSet = job.editor.proposalSets.find((set) => set.id === proposalTarget?.setId);
    const availableSets = selectedSet && !recentSets.includes(selectedSet)
      ? [...recentSets, selectedSet] : recentSets;
    const routeSchema = {
      type: "object",
      properties: {
        capability: { type: "string", enum: Object.keys(CHAT_CAPABILITIES) },
        proposalSetId: { type: "string", enum: ["", ...availableSets.map((set) => set.id)] },
        candidateId: { type: "string", enum: ["", ...new Set(availableSets.flatMap((set) =>
          set.items.map((item) => item.id)))] },
      },
      required: ["capability", "proposalSetId", "candidateId"],
      additionalProperties: false,
    };
    const proposals = availableSets.map((set) => ({
      setId: set.id, kind: set.kind, stale: set.stale,
      candidates: set.items.map((item, index) => ({ number: index + 1, id: item.id,
        text: set.kind === "topic" ? (item as { title: string }).title : (item as { text: string }).text })),
    }));
    const prompt = `사용자의 마지막 메시지를 앱의 동작 하나로 분류하세요. JSON Schema만 반환하세요.
사용 가능한 동작: ${JSON.stringify(CHAT_CAPABILITIES)}
"추천/다시 추천"은 새 후보 제안, "이 후보를 고쳐"는 후보 하나 수정, "선택한 후보를 적용"은 apply_topic 또는 apply_hook입니다.
새 주제나 훅을 작성해 바로 적용하라는 요청은 draft_topic 또는 write_hook입니다.
이미지 생성, 로컬 이미지 풀 검색과 자동 삽입은 아직 채팅에서 실행할 수 없습니다. 그런 요청은 answer로 분류하세요.
선택된 Element는 편집 요청의 대상일 뿐입니다. 주제·훅 요청이나 일반 질문을 막지 마세요.
선택된 제안을 "다듬어/바꿔/줄여" 달라고 하면 해당 후보의 revise_topic 또는 revise_hook을 고르세요. 명시적인 적용 요청 없이 edit_document를 고르지 마세요.
사용자가 후보 번호를 말하면 아래 후보 ID를 고르세요. 대상이 없으면 proposalSetId와 candidateId는 빈 문자열로 두세요.
현재 본문 작성 여부: ${job.editor.bodyReady}
선택된 Element: ${JSON.stringify(elementTarget)}
선택된 제안: ${JSON.stringify(proposalTarget)}
최근 제안: ${JSON.stringify(proposals)}
최근 대화: ${JSON.stringify(job.editor.messages.slice(-6))}
사용자 메시지: ${message}`;
    const result = await this.codex.runStructuredTurn({
      threadId: job.threadId,
      input: [{ type: "text", text: prompt }],
      outputSchema: routeSchema as CodexJsonValue,
    });
    if (result.status !== "completed") throw new Error(result.message);
    const checked = validateStructuredOutput<ChatRoute>(routeSchema, result.output);
    if (!checked.ok) throw new Error(`채팅 동작을 결정하지 못했습니다: ${checked.errors.join(" ")}`);
    return checked.value;
  }
}
