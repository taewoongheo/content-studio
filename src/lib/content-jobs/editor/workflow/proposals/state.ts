import { randomUUID } from "node:crypto";
import type { EditorHook, EditorJobState, EditorProposalSet, EditorProposalTarget, EditorTopic } from "../../types";

export function addProposalSet(
  editor: EditorJobState, kind: "topic" | "hook", items: EditorTopic[] | EditorHook[], messageId: string,
) {
  const set: EditorProposalSet = kind === "topic"
    ? { id: randomUUID(), kind, version: 1, messageId, stale: false, items: items as EditorTopic[] }
    : { id: randomUUID(), kind, version: 1, messageId, stale: false, items: items as EditorHook[] };
  editor.proposalSets.push(set);
  if (editor.proposalSets.length > 30) editor.proposalSets.shift();
  if (kind === "topic") editor.topicSuggestions = items as EditorTopic[];
  else editor.hookSuggestions = items as EditorHook[];
  return set;
}

export function resolveProposal(
  editor: EditorJobState, kind: "topic" | "hook",
  route: { proposalSetId: string; candidateId: string },
  selected: EditorProposalTarget | null,
): { set: EditorProposalSet; candidateId: string } {
  const setId = route.proposalSetId || selected?.setId || "";
  const candidateId = route.candidateId || selected?.candidateId || "";
  const set = setId
    ? editor.proposalSets.find((item) => item.id === setId)
    : editor.proposalSets.findLast((item) => item.kind === kind &&
      item.items.some((candidate) => candidate.id === candidateId));
  if (!set || set.kind !== kind || set.stale || !candidateId ||
    !set.items.some((candidate) => candidate.id === candidateId))
    throw new Error("수정하거나 적용할 제안을 선택해 주세요.");
  return { set, candidateId };
}

export function reviseTopic(editor: EditorJobState, target: { set: EditorProposalSet; candidateId: string },
  revision: Omit<EditorTopic, "id">, messageId: string) {
  if (target.set.kind !== "topic") throw new Error("주제 제안을 선택해 주세요.");
  const items = target.set.items.map((item) => item.id === target.candidateId
    ? { ...revision, id: item.id } : item);
  const next = addProposalSet(editor, "topic", items, messageId);
  next.version = target.set.version + 1;
}

export function reviseHook(editor: EditorJobState, target: { set: EditorProposalSet; candidateId: string },
  revision: Omit<EditorHook, "id">, messageId: string) {
  if (target.set.kind !== "hook") throw new Error("훅 제안을 선택해 주세요.");
  const items = target.set.items.map((item) => item.id === target.candidateId
    ? { ...revision, id: item.id } : item);
  const next = addProposalSet(editor, "hook", items, messageId);
  next.version = target.set.version + 1;
}

export function staleHookProposals(editor: EditorJobState) {
  for (const set of editor.proposalSets) if (set.kind === "hook") set.stale = true;
}
