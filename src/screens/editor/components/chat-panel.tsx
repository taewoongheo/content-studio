"use client";

import { useState } from "react";
import { LoaderCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EditorJobState } from "@/lib/content-jobs/editor/types";
import type { ContentJobOperation } from "@/lib/content-jobs/domain/types";
import type { ChatTarget } from "@/lib/content-jobs/editor/workflow/targeted/chat";

type SelectedChatTarget = ChatTarget & { name: string; scopeLabel: string };

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
  const targetKey = selectedTarget
    ? `${selectedTarget.slideId}:${selectedTarget.placementId}:${selectedTarget.elementId}:${selectedTarget.slideIds.join(",")}` : null;
  const activeTarget = targetKey && targetKey !== dismissedTargetKey ? selectedTarget : null;

  async function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed) return;
    if (await onAction({ action: "chat_edit", message: trimmed,
      ...(activeTarget ? { target: { slideId: activeTarget.slideId, placementId: activeTarget.placementId,
        elementId: activeTarget.elementId, slideIds: activeTarget.slideIds } } : {}) })) setMessage("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[180px] flex-1 space-y-3 overflow-y-auto p-5" aria-live="polite">
        {editor.messages.map((item) => (
          <div key={item.id} className={`max-w-[95%] rounded-lg px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${item.role === "user" ? "ml-auto bg-foreground text-background" : "border bg-background"}`}>
            {item.text}
          </div>
        ))}
        {editor.topicSuggestions.length > 0 && (
          <section className="grid gap-2" aria-label="주제 후보">
            {editor.topicSuggestions.map((topic) => (
              <div key={topic.id} className={`rounded-lg border text-sm ${editor.selectedTopic?.id === topic.id ? "border-foreground bg-muted" : ""}`}>
                <button
                  type="button"
                  disabled={disabled}
                  className="w-full rounded-lg p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void onAction({ action: "select_topic", topicId: topic.id })}
                >
                  <span className="block font-semibold">{topic.title}</span>
                  <span className="mt-1 block text-muted-foreground">{topic.angle} · {topic.rationale}</span>
                </button>
                {topic.sourceUrls.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2 text-xs">
                    {topic.sourceUrls.map((url, index) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                        근거 {index + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}
        {editor.hookSuggestions.length > 0 && (
          <section className="grid gap-2" aria-label="훅 후보">
            {editor.hookSuggestions.map((hook) => (
              <button
                type="button"
                key={hook.id}
                disabled={disabled}
                className={`rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 ${editor.selectedHookId === hook.id ? "border-foreground bg-muted" : ""}`}
                onClick={() => void onAction({ action: "select_editor_hook", hookId: hook.id })}
              >
                <span className="block font-semibold">{hook.text}</span>
                <span className="mt-1 block text-muted-foreground">{hook.rationale}</span>
              </button>
            ))}
          </section>
        )}
        {activeOperation && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {operationLabels[activeOperation] ?? "작업 중…"}
          </p>
        )}
      </div>
      <div className="grid gap-3 border-t p-4">
        {activeTarget ? (
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
          placeholder="예: 본문 2장의 설명을 더 짧게 바꿔줘"
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={disabled} onClick={() => void onAction({ action: "suggest_topics" })}>주제 제안</Button>
            <Button variant="outline" size="sm" disabled={disabled || !editor.bodyReady} onClick={() => void onAction({ action: "suggest_hooks" })}>훅 제안</Button>
          </div>
          <Button size="icon" disabled={disabled || !message.trim()} onClick={() => void sendMessage()} aria-label="메시지 보내기">
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
