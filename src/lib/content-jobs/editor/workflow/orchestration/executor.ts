import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AssetStore, StoredAsset } from "@/lib/local-db/assets";
import type { CodexUserInput } from "@/lib/codex/transport/types";
import type { ContentJobRecord } from "../../../domain/types";
import { applyEditorCommands } from "../../document";
import { validateEditorCommands } from "../../schema";
import type { EditorChatTarget, EditorCommand, EditorDocument } from "../../types";
import { proposalForTarget, type SelectedProposal } from "../proposals/lifecycle";
import { agentContinuationPrompt, agentPrompt } from "./context";
import {
  agentOutputSchema,
  stripNullPatches,
  type AgentActionResult,
  type AgentOutput,
  type AgentReadAction,
} from "./output-schema";

export type StructuredTurn = <T>(schema: Record<string, unknown>, input: CodexUserInput[]) => Promise<T>;
export type ExecutionProgress = (id: string, status: "running" | "completed" | "pending", label?: string) => void;

type AgentExecution = {
  output: AgentOutput;
  document: EditorDocument;
  commands: EditorCommand[];
  assets: StoredAsset[];
  appliedProposal: Exclude<SelectedProposal, null> | null;
};

function actionFingerprint(action: AgentReadAction) {
  const values = action.type === "search_assets" ? action.queries : action.assetIds;
  return JSON.stringify([action.type, [...new Set(values)].toSorted()]);
}

function actionLabel(action: AgentReadAction) {
  return action.type === "search_assets" ? "저장 이미지 검색" : "선택 이미지 확인";
}

function assertAgentOutput(output: AgentOutput) {
  const hasFinalData = output.topics.length > 0 || output.hooks.length > 0 || output.commands.length > 0 ||
    output.appliedProposalId !== "" || output.history !== "none";
  if (output.status === "actions" && (output.actions.length === 0 || hasFinalData))
    throw new Error("조회 액션 응답에는 실행할 조회만 포함해야 합니다.");
  if (output.status !== "actions" && output.actions.length > 0)
    throw new Error("최종 응답에는 조회 액션을 함께 포함할 수 없습니다.");
  if (output.status === "ask_user" && hasFinalData)
    throw new Error("사용자 질문과 문서 변경을 동시에 실행할 수 없습니다.");
  if (output.history === "undo" && (output.commands.length > 0 || output.topics.length > 0 ||
    output.hooks.length > 0 || output.appliedProposalId))
    throw new Error("되돌리기와 다른 변경은 한 번에 실행할 수 없습니다.");
  if (new Set(output.actions.map((action) => action.id)).size !== output.actions.length)
    throw new Error("액션 ID가 중복되었습니다.");
}

function withFallbackReply(output: AgentOutput): AgentOutput {
  if (output.reply.trim() || output.status === "actions") return output;
  if (output.status === "ask_user") throw new Error("사용자에게 확인할 질문이 비어 있습니다.");
  if (output.history === "undo") return { ...output, reply: "마지막 변경을 되돌렸습니다." };
  if (output.commands.length > 0) return { ...output, reply: "요청한 변경을 적용했습니다." };
  if (output.topics.length > 0) return { ...output, reply: "주제 제안을 만들었습니다." };
  if (output.hooks.length > 0) return { ...output, reply: "훅 제안을 만들었습니다." };
  throw new Error("AI 응답이 비어 있습니다.");
}

function assertProposals(output: AgentOutput, selected: SelectedProposal) {
  for (const candidates of [output.topics, output.hooks]) {
    if (new Set(candidates.map((item) => item.id)).size !== candidates.length ||
      candidates.some((item) => !item.id.trim() || !("title" in item ? item.title : item.text).trim()))
      throw new Error("제안 후보의 ID와 내용이 올바르지 않습니다.");
  }
  for (const topic of output.topics) for (const url of topic.sourceUrls) {
    try {
      if (!["http:", "https:"].includes(new URL(url).protocol)) throw new Error();
    } catch { throw new Error("근거 URL이 올바르지 않습니다."); }
  }
  const generated = [
    ...output.topics.map((item) => ({ ...item, kind: "topic" as const })),
    ...output.hooks.map((item) => ({ ...item, kind: "hook" as const })),
  ];
  const applied = output.appliedProposalId
    ? generated.find((item) => item.id === output.appliedProposalId) ??
      (selected?.id === output.appliedProposalId ? selected : null)
    : null;
  if (output.appliedProposalId && !applied) throw new Error("적용할 제안을 찾을 수 없습니다.");
  if (applied && output.commands.length === 0) throw new Error("제안을 적용할 문서 변경 명령이 없습니다.");
  return applied;
}

export function assignServerIds(commands: EditorCommand[], createId: () => string = randomUUID): EditorCommand[] {
  const slideIds = new Map<string, string>();
  const elementIds = new Map<string, string>();
  const placementIds = new Map<string, string>();
  for (const command of commands) {
    if (command.type === "add_slide") slideIds.set(command.newSlideId, createId());
    if (command.type === "add_element") elementIds.set(command.element.id, createId());
    if (command.type === "place_element") placementIds.set(`${command.slideId}:${command.placementId}`, createId());
    if (command.type === "duplicate_placement") {
      elementIds.set(command.newElementId, createId());
      for (const item of command.placements)
        placementIds.set(`${item.slideId}:${item.newPlacementId}`, createId());
    }
  }
  const slide = (id: string) => slideIds.get(id) ?? id;
  const element = (id: string) => elementIds.get(id) ?? id;
  const placement = (slideId: string, id: string) => {
    const declared = placementIds.get(`${slideId}:${id}`);
    if (declared) return declared;
    const mappedSlide = slide(slideId);
    return mappedSlide !== slideId && id.startsWith(`${slideId}-`)
      ? `${mappedSlide}-${id.slice(slideId.length + 1)}` : id;
  };
  return commands.map((command): EditorCommand => {
    switch (command.type) {
      case "reorder_slides": return { ...command, slideIds: command.slideIds.map(slide) };
      case "reorder_layers": return { ...command, slideId: slide(command.slideId),
        placementIds: command.placementIds.map((id) => placement(command.slideId, id)) };
      case "set_slide_background": return { ...command, slideId: slide(command.slideId) };
      case "set_slot_value": return { ...command, slideId: slide(command.slideId),
        placementId: placement(command.slideId, command.placementId) };
      case "update_visual": return command.scope === "common"
        ? { ...command, elementId: element(command.elementId) }
        : { ...command, slideId: slide(command.slideId), placementId: placement(command.slideId, command.placementId) };
      case "update_element": return { ...command, elementId: element(command.elementId) };
      case "add_element": return { ...command, element: { ...command.element, id: element(command.element.id) } };
      case "place_element": return { ...command, slideId: slide(command.slideId), elementId: element(command.elementId),
        placementId: placement(command.slideId, command.placementId) };
      case "add_slide": return { ...command, afterSlideId: slide(command.afterSlideId), sourceSlideId: slide(command.sourceSlideId),
        newSlideId: slide(command.newSlideId) };
      case "remove_slide": return { ...command, slideId: slide(command.slideId) };
      case "remove_placement": return { ...command, slideId: slide(command.slideId),
        placementId: placement(command.slideId, command.placementId) };
      case "duplicate_placement": return { ...command, sourceSlideId: slide(command.sourceSlideId),
        sourcePlacementId: placement(command.sourceSlideId, command.sourcePlacementId),
        newElementId: element(command.newElementId), placements: command.placements.map((item) => ({
          slideId: slide(item.slideId), sourcePlacementId: placement(item.slideId, item.sourcePlacementId),
          newPlacementId: placement(item.slideId, item.newPlacementId),
        })) };
    }
  });
}

function validateFinalOutput(job: ContentJobRecord, selected: SelectedProposal,
  output: AgentOutput, assets: StoredAsset[]) {
  const appliedProposal = assertProposals(output, selected);
  const checked = validateEditorCommands({ commands: stripNullPatches(output.commands) });
  if (!checked.ok) throw new Error(checked.errors.join(" "));
  const commands = assignServerIds(checked.value.commands);
  const document = applyEditorCommands(job.editor.document!, commands);
  const knownAssetIds = new Set([...job.assets, ...assets].map((asset) => asset.id));
  const imageElements = new Set(document.elements.filter((element) => element.kind === "image").map((element) => element.id));
  for (const slide of document.slides) for (const placement of slide.placements) {
    if (placement.value && imageElements.has(placement.elementId) && !knownAssetIds.has(placement.value))
      throw new Error("이미지 슬롯은 조회하거나 업로드한 에셋 ID만 사용할 수 있습니다.");
  }
  return { appliedProposal, commands, document };
}

async function inspectAssets(store: AssetStore, action: Extract<AgentReadAction, { type: "inspect_assets" }>,
  knownAssets: Map<string, StoredAsset>) {
  const ids = [...new Set(action.assetIds)];
  if (ids.some((id) => !knownAssets.has(id))) throw new Error("검색하거나 업로드하지 않은 이미지는 확인할 수 없습니다.");
  const directory = await mkdtemp(join(tmpdir(), "content-studio-inspect-"));
  try {
    const inputs = await Promise.all(ids.map(async (id, index): Promise<CodexUserInput[]> => {
      const image = store.readImage(id);
      if (!image) throw new Error("이미지가 삭제되었습니다. 다시 검색해 주세요.");
      const extension = image.type === "image/jpeg" ? "jpg" : image.type.split("/")[1];
      const path = join(/* turbopackIgnore: true */ directory, `${index}.${extension}`);
      await writeFile(path, image.bytes);
      return [{ type: "text", text: `확인한 asset ID: ${id}` }, { type: "localImage", path, detail: "high" }];
    }));
    return { result: { assetIds: ids, inspected: true }, input: inputs.flat(),
      cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

export async function executeAgent({ job, target, proposalTarget, turn, store, progress }: {
  job: ContentJobRecord;
  target: EditorChatTarget | null;
  proposalTarget: Parameters<typeof proposalForTarget>[1];
  turn: StructuredTurn;
  store: () => AssetStore;
  progress: ExecutionProgress;
}): Promise<AgentExecution> {
  const selectedProposal = proposalForTarget(job.editor, proposalTarget);
  const knownAssets = new Map<string, StoredAsset>();
  for (const asset of job.assets) {
    const stored = store().get(asset.id);
    if (stored) knownAssets.set(stored.id, stored);
  }
  const completedActions = new Map<string, { fingerprint: string; result: AgentActionResult }>();
  const fingerprints = new Map<string, AgentActionResult>();
  let round = 0;
  let pendingOutput: AgentOutput | null = null;
  let latestResults: AgentActionResult[] = [];

  while (true) {
    let output = pendingOutput;
    pendingOutput = null;
    if (!output) {
      const planStepId = `plan-${round}`;
      progress(planStepId, "running", round === 0 ? "요청 이해·작업 계획" : "결과 확인·다음 작업 계획");
      output = withFallbackReply(await turn<AgentOutput>(agentOutputSchema, [{ type: "text", text:
        round === 0
          ? agentPrompt(job, target, selectedProposal, [...knownAssets.values()], [])
          : agentContinuationPrompt(latestResults) }]));
      assertAgentOutput(output);
      progress(planStepId, "completed");
      latestResults = [];
    }

    if (output.status !== "actions") {
      if (output.status === "ask_user") return { output, document: job.editor.document!, commands: [],
        assets: [...knownAssets.values()], appliedProposal: null };
      if (output.commands.length) progress("validate", "running", "편집 명령 검증");
      const validated = validateFinalOutput(job, selectedProposal, output, [...knownAssets.values()]);
      if (output.commands.length) progress("validate", "completed");
      return { output, assets: [...knownAssets.values()], ...validated };
    }

    const fresh = output.actions.filter((action) => !fingerprints.has(actionFingerprint(action)));
    if (fresh.length === 0) throw new Error("같은 조회를 반복해 새 정보가 생기지 않았습니다. 요청을 더 구체적으로 작성해 주세요.");
    const additionalInput: CodexUserInput[] = [];
    const batchResults: AgentActionResult[] = [];
    const cleanups: Array<() => Promise<void>> = [];
    try {
      for (const [index, action] of output.actions.entries()) {
        const fingerprint = actionFingerprint(action);
        const previousById = completedActions.get(action.id);
        if (previousById && previousById.fingerprint !== fingerprint)
          throw new Error("같은 액션 ID를 다른 요청에 다시 사용할 수 없습니다.");
        const cached = fingerprints.get(fingerprint);
        if (cached) {
          const result = { ...cached, actionId: action.id };
          batchResults.push(result);
          continue;
        }
        const stepId = `action-${round}-${index}`;
        progress(stepId, "running", actionLabel(action));
        let result: AgentActionResult;
        if (action.type === "search_assets") {
          const assets = [...new Map(action.queries.flatMap((query) => store().search(query, 6))
            .map((asset) => [asset.id, asset])).values()].slice(0, 30);
          for (const asset of assets) knownAssets.set(asset.id, asset);
          result = { actionId: action.id, type: action.type,
            result: assets.map(({ id, name, description }) => ({ id, name, description })) };
        } else {
          const inspected = await inspectAssets(store(), action, knownAssets);
          result = { actionId: action.id, type: action.type, result: inspected.result };
          additionalInput.push(...inspected.input);
          cleanups.push(inspected.cleanup);
        }
        batchResults.push(result);
        fingerprints.set(fingerprint, result);
        completedActions.set(action.id, { fingerprint, result });
        progress(stepId, "completed");
      }
      round += 1;
      latestResults = batchResults;
      if (additionalInput.length) {
        const nextPlanStepId = `plan-${round}`;
        progress(nextPlanStepId, "running", "이미지 확인·다음 작업 계획");
        const output = withFallbackReply(await turn<AgentOutput>(agentOutputSchema, [{ type: "text", text:
          agentContinuationPrompt(batchResults) }, ...additionalInput]));
        assertAgentOutput(output);
        progress(nextPlanStepId, "completed");
        if (output.status === "actions") {
          pendingOutput = output;
          continue;
        }
        if (output.status === "ask_user") return { output, document: job.editor.document!, commands: [],
          assets: [...knownAssets.values()], appliedProposal: null };
        if (output.commands.length) progress("validate", "running", "편집 명령 검증");
        const validated = validateFinalOutput(job, selectedProposal, output, [...knownAssets.values()]);
        if (output.commands.length) progress("validate", "completed");
        return { output, assets: [...knownAssets.values()], ...validated };
      }
    } finally {
      await Promise.all(cleanups.map((cleanup) => cleanup()));
    }
  }
}
