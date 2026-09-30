import type { EditorHook, EditorJobState, EditorProposalSet, EditorProposalTarget, EditorTopic } from "../../types";

export type SelectedProposal = (EditorTopic & { kind: "topic" }) | (EditorHook & { kind: "hook" }) | null;

/** Card lifetime is derived from the transcript, so undo cannot reopen an old card. */
export function isProposalInteractive(editor: Pick<EditorJobState, "messages">, set: EditorProposalSet) {
  const index = editor.messages.findIndex((message) => message.id === set.messageId);
  return !set.stale && !set.consumed && index >= 0 &&
    !editor.messages.slice(index + 1).some((message) => message.role === "user");
}

export function proposalForTarget(editor: EditorJobState, target: EditorProposalTarget | null): SelectedProposal {
  const set = editor.proposalSets.find((item) => item.id === target?.setId);
  const item = set?.items.find((item) => item.id === target?.candidateId);
  if (!set || !item) return null;
  return set.kind === "topic"
    ? { ...(item as EditorTopic), kind: "topic" }
    : { ...(item as EditorHook), kind: "hook" };
}
