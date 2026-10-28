"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAssistantController, type AssistantControllerProps } from "./use-assistant-controller";
import { LoaderCircle, Sparkles, X } from "lucide-react";

export function EditorAssistant({ target, selection, scopeLabel, beforeStart, onSettled, onBusy, children }: {
  scopeLabel: string; children: ReactNode;
} & AssistantControllerProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [message, setMessage] = useState("");
  const panel = useRef<HTMLDivElement>(null), cursor = useRef<HTMLSpanElement>(null), field = useRef<HTMLTextAreaElement>(null);
  const { status, sending, running, error, send: execute, stop } = useAssistantController({ target, selection, beforeStart, onSettled, onBusy });
  async function send(text: string) { if (await execute(text)) setMessage(""); }
  useEffect(() => {
    if (!position) return;
    field.current?.focus();
    const close = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !(event.target as Element).closest("[data-ai-trigger]") && event.button === 0) setPosition(null); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setPosition(null); };
    window.addEventListener("pointerdown", close); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", close); window.removeEventListener("keydown", key); };
  }, [position]);
  function toggle(x: number, y: number) {
    setPosition(previous => previous ? null : { x: Math.max(8, Math.min(x, window.innerWidth - 376)), y: Math.max(8, Math.min(y, window.innerHeight - 360)) });
  }
  return <div className="contents" onContextMenuCapture={event => {
    event.preventDefault(); event.stopPropagation(); toggle(event.clientX, event.clientY);
  }} onKeyDownCapture={event => {
    if (event.altKey && event.key === "/") { event.preventDefault(); toggle(window.innerWidth - 390, 100); }
  }} onPointerMoveCapture={event => {
    if (cursor.current) { cursor.current.style.transform = `translate(${event.clientX + 14}px, ${event.clientY + 16}px)`; cursor.current.style.display = "block"; }
  }} onPointerLeave={() => { if (cursor.current) cursor.current.style.display = "none"; }}>
    {children}
    <span ref={cursor} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-40 hidden rounded-full border bg-background/90 p-1 text-muted-foreground shadow-sm"><Sparkles className="size-3" /></span>
    <button type="button" data-ai-trigger aria-label="AI 명령 열기" title="AI 명령 · 우클릭 또는 Alt+/" onClick={() => toggle(window.innerWidth - 390, window.innerHeight - 370)}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border bg-background px-3 py-2 text-xs shadow-md">
      {running ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {running ? "작업 중" : "AI"}
    </button>
    {position && createPortal(<div ref={panel} role="dialog" aria-label="에디터 AI 명령" onContextMenu={event => { event.preventDefault(); setPosition(null); }}
      style={{ left: position.x, top: position.y, maxHeight: `calc(100dvh - ${position.y + 8}px)` }} className="fixed z-[100] flex max-h-[calc(100dvh-16px)] w-[368px] max-w-[calc(100vw-16px)] flex-col gap-3 overflow-y-auto rounded-xl border bg-background p-4 text-foreground shadow-xl">
      <div className="flex items-center justify-between"><span className="text-sm font-medium">AI 편집 · {scopeLabel}</span><button aria-label="AI 명령 닫기" onClick={() => setPosition(null)}><X className="size-4" /></button></div>
      {status?.text && <div className="whitespace-pre-wrap text-sm leading-6">{status.text}</div>}
      {status?.suggestion && <button className="self-start rounded-md border px-3 py-1.5 text-sm" disabled={running} onClick={() => void send(status.suggestion)}>제안 적용</button>}
      <textarea ref={field} aria-label="AI 편집 명령" placeholder="이미지 크기를 시각적으로 맞춰 줘" value={message} onChange={event => setMessage(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(message); } }}
        className="min-h-24 resize-none rounded-md border bg-transparent p-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
      {(error || status?.error) && <p role="alert" className="text-sm text-destructive">{error || status?.error}</p>}
      <div className="flex items-center justify-between gap-3"><span role="status" className="text-xs text-muted-foreground">{sending ? "준비 중" : status?.phase || (status?.state === "stopped" ? "중단됨" : "Enter 실행 · Shift+Enter 줄바꿈")}</span>
        {status?.state === "running" ? <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => void stop()}>중단</button>
          : <button disabled={running || !message.trim()} className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-40" onClick={() => void send(message)}>실행</button>}
      </div>
    </div>, document.body)}
  </div>;
}
