"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, LoaderCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EditorChatTarget, EditorJobState, EditorProposalTarget } from "@/lib/content-jobs/editor/types";
import type { ContentJobOperation } from "@/lib/content-jobs/domain/types";
import { ProposalCards } from "./chat/proposal-cards";
import { useChatAttachment } from "./chat/use-chat-attachment";
import { isProposalInteractive } from "@/lib/content-jobs/editor/workflow/proposals/lifecycle";
import { ExecutionProgress } from "./chat/execution-progress";

type SelectedChatTarget = { target: EditorChatTarget; name: string; scopeLabel: string };

const operationLabels: Partial<Record<ContentJobOperation, string>> = {
  suggest_topics: "주제를 조사하고 있습니다…",
  fill_body: "슬라이드 내용을 채우고 있습니다…",
  suggest_hooks: "훅을 만들고 있습니다…",
  chat_edit: "요청을 반영하고 있습니다…",
};

export function ChatPanel({
  jobId,
  editor,
  activeOperation,
  disabled,
  selectedTarget,
  onAction,
}: {
  jobId: string;
  editor: EditorJobState;
  activeOperation: ContentJobOperation | null;
  disabled: boolean;
  selectedTarget: SelectedChatTarget | null;
  onAction: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [message, setMessage] = useState("");
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const { attachments, error: imageError, dragging, fileInputRef, receive, clear, remove, dragHandlers } =
    useChatAttachment(disabled);
  const [dismissedTargetKey, setDismissedTargetKey] = useState<string | null>(null);
  const [proposalSelection, setProposalSelection] = useState<{
    target: EditorProposalTarget; elementKey: string | null; proposalCount: number;
  } | null>(null);
  const targetKey = selectedTarget
    ? `${selectedTarget.target.slideId}:${selectedTarget.target.placementId}:${selectedTarget.target.elementId}:${selectedTarget.target.slideIds.join(",")}` : null;
  const selectedProposalSet = editor.proposalSets.find((set) => set.id === proposalSelection?.target.setId);
  const activeProposal = proposalSelection?.elementKey === targetKey &&
    proposalSelection.proposalCount === editor.proposalSets.length && selectedProposalSet &&
    isProposalInteractive(editor, selectedProposalSet) && selectedProposalSet.items.some((item) => item.id === proposalSelection.target.candidateId)
    ? proposalSelection.target : null;
  const activeTarget = !activeProposal && targetKey && targetKey !== dismissedTargetKey ? selectedTarget : null;
  const selectedCandidate = selectedProposalSet?.items.find((item) => item.id === activeProposal?.candidateId);
  const latestMessage = editor.messages.at(-1);

  useLayoutEffect(() => {
    const viewport = messagesViewportRef.current;
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [latestMessage, activeOperation]);

  async function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed && attachments.length === 0) return;
    if (await onAction({ action: "chat_edit", message: trimmed,
      ...(attachments.length ? { images: attachments.map((item) => item.file) } : {}),
      ...(activeProposal ? { proposalTarget: activeProposal } : {}),
      ...(activeTarget ? { target: activeTarget.target } : {}) })) {
      setMessage("");
      clear();
    }
  }

  function applyProposal(target: EditorProposalTarget) {
    const set = editor.proposalSets.find((item) => item.id === target.setId);
    if (!set || !isProposalInteractive(editor, set)) return;
    void onAction(set.kind === "topic"
      ? { action: "select_topic", topicId: target.candidateId, proposalSetId: set.id }
      : { action: "select_editor_hook", hookId: target.candidateId, proposalSetId: set.id });
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" {...dragHandlers}>
      {dragging && <div className="pointer-events-none absolute inset-2 z-20 grid place-items-center rounded-lg border-2 border-dashed border-foreground bg-background/95 text-sm font-medium">이미지를 놓아 채팅에 첨부</div>}
      <div ref={messagesViewportRef} className="min-h-[180px] flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
        {editor.messages.map((item) => {
          if (item.execution) return <ExecutionProgress key={item.id} execution={item.execution} />;
          const proposalSets = editor.proposalSets.filter((set) => set.messageId === item.id);
          return <div key={item.id} className="grid gap-2">
            <div className={`max-w-[95%] rounded-lg px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${item.role === "user" ? "ml-auto bg-foreground text-background" : "border bg-background"}`}>
              {item.proposalLabel && <span className="mb-1 block text-xs opacity-70">{item.proposalLabel}</span>}
              {(item.images ?? (item.image ? [item.image] : [])).length > 0 &&
                <div className="mb-2 flex flex-wrap gap-2">
                  {(item.images ?? (item.image ? [item.image] : [])).map((image) =>
                    <Image key={image.id} src={`/api/content-jobs/${encodeURIComponent(jobId)}/chat-images/${encodeURIComponent(image.id)}`}
                      alt={image.name} width={180} height={120} unoptimized
                      className="max-h-40 w-auto max-w-full rounded-md object-contain" />)}
                </div>}
              {item.text}
            </div>
            {proposalSets.map((proposalSet) => <ProposalCards key={proposalSet.id} set={proposalSet} editor={editor} selected={activeProposal}
              disabled={disabled || !isProposalInteractive(editor, proposalSet)}
              onSelect={(target) => {
                setProposalSelection({ target, elementKey: targetKey,
                  proposalCount: editor.proposalSets.length });
                setDismissedTargetKey(targetKey);
              }} onApply={applyProposal} />)}
          </div>;
        })}
        {activeOperation && !editor.messages.some((item) => item.execution?.steps.some((step) => step.status === "running")) && (
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
        {attachments.length > 0 && <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto" aria-label="첨부 이미지">
          {attachments.map((attachment) => <div key={attachment.url} className="flex max-w-full items-center gap-2 rounded-lg border bg-muted/30 p-2">
            <Image src={attachment.url} alt={attachment.file.name} width={48} height={48} unoptimized
              className="size-12 rounded-md object-cover" />
            <span className="max-w-28 truncate text-xs" title={attachment.file.name}>{attachment.file.name}</span>
            <Button type="button" size="icon-sm" variant="ghost" disabled={disabled}
              onClick={() => remove(attachment.url)}
              aria-label={`${attachment.file.name} 첨부 제거`}><X className="size-4" /></Button>
          </div>)}
        </div>}
        {imageError && <p role="alert" className="text-xs text-destructive">{imageError}</p>}
        <label className="sr-only" htmlFor="editor-message">수정 요청 또는 질문</label>
        <Textarea
          id="editor-message"
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
        <div className="flex items-center justify-between">
          <input ref={fileInputRef} type="file" multiple accept="image/png,image/jpeg,image/webp" className="sr-only"
            aria-label="채팅 이미지 선택" onChange={(event) => receive(event.target.files)} />
          <Button type="button" size="icon" variant="ghost" disabled={disabled}
            onClick={() => fileInputRef.current?.click()} aria-label="이미지 첨부" title="이미지 첨부">
            <ImagePlus className="size-4" />
          </Button>
          <Button size="icon" disabled={disabled || (!message.trim() && attachments.length === 0)} onClick={() => void sendMessage()} aria-label="메시지 보내기">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
