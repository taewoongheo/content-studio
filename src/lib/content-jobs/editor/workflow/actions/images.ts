import type { StoredAsset } from "@/lib/local-db/assets";
import type { ContentJobRecord } from "../../../domain/types";
import type { EditorChatTarget, EditorDocument } from "../../types";

export type ImageChoice = { reply: string; assetId: string; slideId: string };

export function imageChoiceSchema(document: EditorDocument, assets: StoredAsset[]) {
  return {
    type: "object",
    properties: {
      reply: { type: "string" },
      assetId: { type: "string", enum: ["", ...assets.map((asset) => asset.id)] },
      slideId: { type: "string", enum: document.slides.map((slide) => slide.id) },
    },
    required: ["reply", "assetId", "slideId"],
    additionalProperties: false,
  };
}

export function imageChoicePrompt(job: ContentJobRecord, assets: StoredAsset[],
  action: "add_image" | "replace_image", target: EditorChatTarget | null) {
  const catalog = assets.map(({ id, name, description }) => ({ id, name, description }));
  return `사용자에게 답하는 reply는 한국어로 작성하세요. 지정된 JSON Schema만 반환하세요.
요청 동작: ${action === "add_image" ? "새 이미지 Element 추가" : "선택한 이미지 Element의 이미지 교체"}
이미지 파일 자체는 보지 못합니다. 저장된 에셋의 이름과 설명을 보고 가장 맞는 assetId를 고르세요.
맞는 에셋이 없고 새 Element 추가 요청이면 assetId를 빈 문자열로 두어 빈 이미지 슬롯을 추가하세요. 교체 요청에서는 빈 문자열을 선택하지 마세요.
선택된 Element의 slideId를 기본 대상으로 사용하되 사용자가 다른 장을 명시했다면 해당 장을 선택하세요.
선택된 Element: ${JSON.stringify(target)}
슬라이드: ${JSON.stringify(job.editor.document?.slides.map(({ id, role }) => ({ id, role })))}
저장된 이미지 에셋: ${JSON.stringify(catalog)}
마지막 사용자 요청: ${job.editor.messages.at(-1)?.text ?? ""}`;
}
