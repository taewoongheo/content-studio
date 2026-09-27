"use client";

import { useState } from "react";
import { LoaderCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EditorChatTarget, EditorJobState, EditorProposalTarget } from "@/lib/content-jobs/editor/types";
import type { ContentJobOperation } from "@/lib/content-jobs/domain/types";
import { ProposalCards } from "./chat/proposal-cards";

type SelectedChatTarget = { target: EditorChatTarget; name: string; scopeLabel: string };

const operationLabels: Partial<Record<ContentJobOperation, string>> = {
  suggest_topics: "주제를 조사하고 있습니다…",
  fill_body: "슬라이드 내용을 채우고 있습니다…",
  suggest_hooks: "훅을 만들고 있습니다…",
  chat_edit: "요청을 반영하고 있습니다…",
};

export function ChatPanel({
  editor,
  activeOperation,
  disabled,
  selectedTarget,
  onAction,
}: {
  editor: EditorJobState;
  activeOperation: ContentJobOperation | null;
  disabled: boolean;
  selectedTarget: SelectedChatTarget | null;
  onAction: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [message, setMessage] = useState("");
  const [dismissedTargetKey, setDismissedTargetKey] = useState<string | null>(null);
  const [proposalSelection, setProposalSelection] = useState<{
    target: EditorProposalTarget; elementKey: string | null; proposalCount: number;
  } | null>(null);
  const targetKey = selectedTarget
    ? `${selectedTarget.target.slideId}:${selectedTarget.target.placementId}:${selectedTarget.target.elementId}:${selectedTarget.target.slideIds.join(",")}` : null;
  const selectedProposalSet = editor.proposalSets.find((set) => set.id === proposalSelection?.target.setId);
  const activeProposal = proposalSelection?.elementKey === targetKey &&
    proposalSelection.proposalCount === editor.proposalSets.length && selectedProposalSet &&
    !selectedProposalSet.stale && selectedProposalSet.items.some((item) => item.id === proposalSelection.target.candidateId)
    ? proposalSelection.target : null;
  const activeTarget = !activeProposal && targetKey && targetKey !== dismissedTargetKey ? selectedTarget : null;
  const selectedCandidate = selectedProposalSet?.items.find((item) => item.id === activeProposal?.candidateId);

  async function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (await onAction({ action: "chat_edit", message: trimmed,
      ...(activeProposal ? { proposalTarget: activeProposal } : {}),
      ...(activeTarget ? { target: activeTarget.target } : {}) })) setMessage("");
  }

  function applyProposal(target: EditorProposalTarget) {
    const set = editor.proposalSets.find((item) => item.id === target.setId);
    if (!set || set.stale) return;
    void onAction(set.kind === "topic"
      ? { action: "select_topic", topicId: target.candidateId, proposalSetId: set.id }
      : { action: "select_editor_hook", hookId: target.candidateId, proposalSetId: set.id });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[180px] flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
        {editor.messages.map((item) => {
          const proposalSet = editor.proposalSets.find((set) => set.messageId === item.id);
          return <div key={item.id} className="grid gap-2">
            <div className={`max-w-[95%] rounded-lg px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${item.role === "user" ? "ml-auto bg-foreground text-background" : "border bg-background"}`}>
              {item.proposalLabel && <span className="mb-1 block text-xs opacity-70">{item.proposalLabel}</span>}
              {item.text}
            </div>
            {proposalSet && <ProposalCards set={proposalSet} editor={editor} selected={activeProposal} disabled={disabled}
              onSelect={(target) => {
                setProposalSelection({ target, elementKey: targetKey,
                  proposalCount: editor.proposalSets.length });
                setDismissedTargetKey(targetKey);
              }} onApply={applyProposal} />}
          </div>;
        })}
        {activeOperation && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {operationLabels[activeOperation] ?? "작업 중…"}
          </p>
        )}
      </div>
      <div className="grid gap-3 border-t p-4">
        {activeProposal && selectedCandidate ? (
          <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs">
            <span className="shrink-0 text-muted-foreground">선택된 제안</span>
            <span className="min-w-0 flex-1 truncate font-semibold">
              {selectedProposalSet?.kind === "topic" ? (selectedCandidate as { title: string }).title : (selectedCandidate as { text: string }).text}
            </span>
            <button type="button" onClick={() => setProposalSelection(null)} disabled={disabled}
              className="rounded p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
              aria-label="제안 선택 해제" title="제안 선택 해제"><X className="size-3.5" aria-hidden="true" /></button>
          </div>
        ) : activeTarget ? (
          <div className="flex min-w-0 items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs">
            <span className="shrink-0 text-muted-foreground">선택된 Element</span>
            <span className="min-w-0 flex-1 truncate font-semibold" title={activeTarget.name}>{activeTarget.name}</span>
            <span className="shrink-0 text-muted-foreground">{activeTarget.scopeLabel}</span>
            <button type="button" onClick={() => setDismissedTargetKey(targetKey)} disabled={disabled}
              className="rounded p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50"
              aria-label="채팅 대상 해제" title="채팅 대상 해제"><X className="size-3.5" aria-hidden="true" /></button>
          </div>
        ) : selectedTarget ? (
          <button type="button" onClick={() => setDismissedTargetKey(null)} disabled={disabled}
            className="justify-self-start rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground disabled:opacity-50">
            선택한 Element를 채팅 대상으로 사용
          </button>
        ) : null}
        <label className="sr-only" htmlFor="editor-message">수정 요청 또는 질문</label>
        <Textarea
          id="editor-message"
          placeholder="예: 주제를 다시 추천해줘 · 선택한 제안을 더 짧게 바꿔줘"
          className="min-h-20 resize-y"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void sendMessage();
            }
          }}
        />
        <div className="flex justify-end">
          <Button size="icon" disabled={disabled || !message.trim()} onClick={() => void sendMessage()} aria-label="메시지 보내기">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
