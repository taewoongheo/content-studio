"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Copy, Layers3, LoaderCircle, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import type { EditorCommand, ElementDefinition, ElementFrame, ElementKind } from "@/lib/content-jobs/editor/types";
import { BACKGROUND_ELEMENT_ID, BACKGROUND_PLACEMENT_ID, ensureSharedBackground, getDuplicateTargets } from "@/lib/content-jobs/editor/document";
import { uploadEditorImage } from "@/screens/content-job/api";
import { useContentJob } from "@/screens/content-job/use-content-job";
import { ChatPanel } from "./components/chat-panel";
import { ElementInspector, type ElementInspectorHandle } from "./components/inspector/element-inspector";
import { ElementScopePicker } from "./components/element-scope-picker";
import { removalCommandsForScope, selectVisualSlides, visualScopeLabel, type ScopeChoice } from "./components/element-scope";
import { SlideCanvas } from "./components/canvas/slide-canvas";
import { SlideBackground } from "./components/inspector/slide-background";
import { frameCommandsForScope } from "./components/canvas/frame-commands";
import { resolveEditorSelection, roleLabels } from "./editor-selection";

export function EditorScreen({ initialJob, onNewJob }: { initialJob: ContentJobSnapshot; onNewJob: () => void }) {
  const { job, submitting, clientError, send } = useContentJob(initialJob);
  const [slideId, setSlideId] = useState("slide-1");
  const [placementId, setPlacementId] = useState<string | null>(null);
  const [scopeSelection, setScopeSelection] = useState<{ key: string; slideIds: string[] } | null>(null);
  const [imageError, setImageError] = useState("");
  const [showGuides, setShowGuides] = useState(true);
  const inspectorRef = useRef<ElementInspectorHandle>(null);
  const latestRevision = useRef(job.editor.revision);
  const commandQueue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    latestRevision.current = Math.max(latestRevision.current, job.editor.revision);
  }, [job.editor.revision]);
  const document = useMemo(() => job.editor.document
    ? ensureSharedBackground(structuredClone(job.editor.document)) : null, [job.editor.document]);
  const { slide, placement, element, appliedSlides, visualTargets, scopeKey, selectedSlideIds } =
    resolveEditorSelection(document, slideId, placementId, scopeSelection);
  const disabled = submitting || Boolean(job.activeOperation);
  const issue = clientError || imageError || job.lastError;
  const referenceImage = job.structure === "repeating"
    ? job.referenceImages.find((image) => image.role === slide?.role)
    : job.referenceImages[document?.slides.findIndex((item) => item.id === slide?.id) ?? -1];

  async function action(body: Record<string, unknown>) {
    try {
      await commandQueue.current;
      const updated = await send({ ...body, expectedRevision: latestRevision.current });
      latestRevision.current = updated.editor.revision;
      return true;
    } catch {
      // useContentJob exposes the error in the editor.
      return false;
    }
  }

  async function saveCommands(commands: EditorCommand[]) {
    const pending = commandQueue.current.then(async () => {
      try {
        const updated = await send({ action: "editor_command", commands, expectedRevision: latestRevision.current });
        latestRevision.current = updated.editor.revision;
        return true;
      } catch {
        return false;
      }
    });
    commandQueue.current = pending.then(() => undefined);
    return pending;
  }

  async function uploadImage(file: File) {
    if (!slide || !placement) return;
    setImageError("");
    try {
      const updated = await uploadEditorImage(job.id, file);
      const asset = updated.assets.at(-1);
      if (!asset) throw new Error("업로드한 이미지를 찾을 수 없습니다.");
      latestRevision.current = Math.max(latestRevision.current, updated.editor.revision);
      await saveCommands([{ type: "set_slot_value", slideId: slide.id, placementId: placement.id, value: asset.id }]);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "이미지를 추가하지 못했습니다.");
    }
  }

  async function addElement(kind: Exclude<ElementKind, "background">) {
    if (!slide) return;
    const id = crypto.randomUUID();
    const newPlacementId = crypto.randomUUID();
    const sourceImageId = job.referenceImages.find((image) => image.role === slide.role)?.id ?? job.referenceImages[0]?.id ?? "";
    const shapeNames = { rectangle: "사각형", circle: "원형", triangle: "삼각형" } as const;
    const isShape = kind in shapeNames;
    const name = isShape ? shapeNames[kind as keyof typeof shapeNames] : kind === "text" ? "새 텍스트" : "새 이미지";
    const newElement: ElementDefinition = {
      id,
      name,
      role: isShape ? "이 장의 시각적 강조" : kind === "text" ? "이 장의 추가 설명" : "이 장의 시각 자료",
      kind,
      frame: isShape ? { x: 0.35, y: 0.35, width: 0.3, height: 0.2 } : { x: 0.15, y: 0.4, width: 0.7, height: 0.2 },
      style: { color: "#111111", backgroundColor: isShape ? "#111111" : "transparent", fontSize: 36, fontWeight: 700, textAlign: "center", borderRadius: 0, fontFamily: "sans-serif", imageFit: "cover" },
      sourceImageId,
    };
    const saved = await saveCommands([
      { type: "add_element", element: newElement },
      { type: "place_element", slideId: slide.id, elementId: id, placementId: newPlacementId },
    ]);
    if (saved) setPlacementId(newPlacementId);
  }

  async function duplicateElement() {
    if (!document || !slide || !placement || element?.kind === "background") return;
    if (inspectorRef.current && !(await inspectorRef.current.flushPending())) return;
    const targets = getDuplicateTargets(document, slide.id, placement.id, selectedSlideIds);
    const placements = targets.map((target) => ({ ...target, newPlacementId: crypto.randomUUID() }));
    const newElementId = crypto.randomUUID();
    const saved = await saveCommands([{ type: "duplicate_placement", sourceSlideId: slide.id,
      sourcePlacementId: placement.id, newElementId, placements }]);
    if (saved) setPlacementId(placements.find((item) => item.slideId === slide.id && item.sourcePlacementId === placement.id)?.newPlacementId ?? null);
  }

  async function removeElement() {
    if (!placement || element?.kind === "background") return;
    const commands = removalCommandsForScope(visualTargets, selectedSlideIds);
    if (commands.length === 0) return;
    if (commands.length > 1 && !window.confirm(`선택한 ${selectedSlideIds.length}장에서 ${element?.name ?? "Element"}를 제거할까요?\n되돌리기로 복원할 수 있습니다.`)) return;
    const saved = await saveCommands(commands);
    if (saved) setPlacementId(null);
  }

  async function changeVisualScope(choice: ScopeChoice) {
    if (!slide || !placement || disabled) return;
    const next = selectVisualSlides(slide.id, appliedSlides.map((item) => item.slideId), selectedSlideIds, choice);
    if (next.join() === selectedSlideIds.join()) return;
    if (inspectorRef.current && !(await inspectorRef.current.flushPending())) return;
    setScopeSelection({ key: scopeKey, slideIds: next });
  }

  async function changeFrame(targetPlacementId: string, frame: ElementFrame) {
    if (!slide || !placement || !element || placement.id !== targetPlacementId || element.kind === "background") return false;
    if (inspectorRef.current && !(await inspectorRef.current.flushPending())) return false;
    const commands = frameCommandsForScope(element.id, frame, visualTargets, selectedSlideIds);
    return commands.length === 0 || saveCommands(commands);
  }

  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-background text-foreground max-lg:h-auto max-lg:min-h-svh max-lg:overflow-visible">
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onNewJob} aria-label="새 작업으로 돌아가기"><ArrowLeft className="size-4" /></Button>
          <h1 className="truncate text-sm font-semibold">Content Studio <span className="font-normal text-muted-foreground">/ 슬라이드 편집기</span></h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <p className="hidden text-xs text-muted-foreground sm:block">{job.structure === "repeating" ? "반복형" : "장면별 구성"} · {job.slideCount}장 · {job.outputLanguage}</p>
          <Button variant="outline" size="sm" disabled={disabled || !document} onClick={() => void action({ action: "editor_undo" })}>
            <Undo2 className="size-4" aria-hidden="true" /> 되돌리기
          </Button>
        </div>
      </header>

      {issue && <p role="alert" className="mx-5 mt-4 shrink-0 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{issue}</p>}

      {!document ? (
        <main className="grid min-h-0 flex-1 place-items-center px-5 text-center">
          <div className="grid max-w-md justify-items-center gap-3">
            {job.editor.status === "analyzing" ? <LoaderCircle className="size-6 animate-spin" aria-hidden="true" /> : null}
            <h2 className="text-xl font-semibold">{job.editor.status === "analyzing" ? "레퍼런스로 편집기 초안을 만드는 중" : "편집기 초안을 준비하지 못했습니다"}</h2>
            <p className="text-sm leading-6 text-muted-foreground">이미지에서 슬라이드 역할과 Element의 시각 스타일·의미를 읽고 있습니다.</p>
            {job.editor.status === "pending" && <Button onClick={() => void action({ action: "initialize_editor" })} disabled={disabled}>분석 다시 시작</Button>}
          </div>
        </main>
      ) : slide ? (
        <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden bg-muted/30 p-3 lg:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(300px,360px)] lg:gap-4 lg:p-4 2xl:grid-cols-[minmax(300px,340px)_minmax(0,1fr)_minmax(340px,400px)] max-lg:overflow-visible">
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-background shadow-sm max-lg:order-2 max-lg:min-h-[360px]" aria-label="선택 항목 편집">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {element?.kind === "background" && placement ? (
                <SlideBackground
                  color={slide.backgroundColor}
                  disabled={disabled}
                  onSave={(color) => saveCommands(selectedSlideIds.length === document.slides.length
                    ? [{ type: "update_visual", scope: "common", elementId: BACKGROUND_ELEMENT_ID,
                      style: { backgroundColor: color } }]
                    : selectedSlideIds.map((targetSlideId): EditorCommand => ({ type: "update_visual", scope: "local",
                      slideId: targetSlideId, placementId: BACKGROUND_PLACEMENT_ID,
                      style: { backgroundColor: color } })))}
                />
              ) : element && placement ? (
                <ElementInspector
                  key={`${scopeKey}:${selectedSlideIds.join(",")}`}
                  ref={inspectorRef}
                  element={element}
                  placement={placement}
                  slideId={slide.id}
                  selectedSlideIds={selectedSlideIds}
                  visualTargets={visualTargets}
                  disabled={disabled}
                  onSave={saveCommands}
                  onUploadImage={uploadImage}
                />
              ) : null}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-background shadow-sm max-lg:order-1 max-lg:min-h-[620px]" aria-label="슬라이드 편집 영역">
            <nav aria-label="페이지 선택" className="shrink-0 border-b px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">페이지</h2>
                <div className="flex items-center gap-2">
                  <Button type="button" variant={showGuides ? "secondary" : "ghost"} size="sm"
                    aria-pressed={showGuides} onClick={() => setShowGuides((current) => !current)}
                    title="중앙 가로·세로선에 Element가 맞춰집니다.">
                    가이드 {showGuides ? "켜짐" : "꺼짐"}
                  </Button>
                  {referenceImage && (
                  <details className="relative text-xs">
                    <summary className="cursor-pointer rounded-md px-2 py-1 font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground">레퍼런스 보기</summary>
                    <div className="absolute top-full right-0 z-20 mt-2 rounded-lg border bg-background p-2 shadow-lg">
                      <Image
                        src={`/api/content-jobs/${encodeURIComponent(job.id)}/references/${encodeURIComponent(referenceImage.id)}`}
                        alt={`${roleLabels[slide.role]} 레퍼런스`}
                        width={240}
                        height={400}
                        unoptimized
                        className="max-h-72 w-auto max-w-[min(240px,70vw)] object-contain"
                      />
                    </div>
                  </details>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {document.slides.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => { setSlideId(item.id); setPlacementId(null); }}
                    aria-current={item.id === slide.id ? "page" : undefined}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${item.id === slide.id ? "border-foreground bg-muted text-foreground" : "border-border bg-background text-muted-foreground"}`}
                  >
                    {index + 1}장 · {roleLabels[item.role]}
                  </button>
                ))}
              </div>
            </nav>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/20 p-5 sm:p-6">
              <SlideCanvas key={slide.id} document={document} slide={slide} jobId={job.id}
                selectedPlacementId={placement?.id ?? null} disabled={disabled} showGuides={showGuides}
                onSelect={setPlacementId} onSelectBackground={() => setPlacementId(BACKGROUND_PLACEMENT_ID)}
                onFrameChange={changeFrame} />
            </div>
            <div className="shrink-0 border-t px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">Element</h2>
                  {element && placement && appliedSlides.length > 1 && <ElementScopePicker
                    key={scopeKey}
                    currentSlideId={slide.id}
                    slides={appliedSlides}
                    selectedSlideIds={selectedSlideIds}
                    isBackground={element.kind === "background"}
                    disabled={disabled}
                    onChange={changeVisualScope}
                  />}
                  {element && placement && appliedSlides.length === 1 && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers3 className="size-3.5" aria-hidden="true" /> {visualScopeLabel(1, 1)}
                  </span>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {element && placement && element.kind !== "background" && <div className="mr-1 flex items-center gap-1.5 border-r pr-2">
                    <Button size="sm" variant="outline" disabled={disabled} onClick={() => void duplicateElement()} aria-label={`선택한 ${selectedSlideIds.length}장에서 ${element.name} 복제`}><Copy className="size-3.5" aria-hidden="true" /> 복제</Button>
                    <Button size="icon-sm" variant="destructive" disabled={disabled} onClick={() => void removeElement()}
                      aria-label={`선택한 ${selectedSlideIds.length}장에서 ${element.name} 제거`}
                      title={`선택한 ${selectedSlideIds.length}장에서 제거`}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
                  </div>}
                  <Button size="sm" variant="outline" disabled={disabled} onClick={() => void addElement("text")}>텍스트 추가</Button>
                  <Button size="sm" variant="outline" disabled={disabled} onClick={() => void addElement("image")}>이미지 추가</Button>
                  <label className="sr-only" htmlFor="add-shape">도형 추가</label>
                  <select id="add-shape" defaultValue="" disabled={disabled} className="h-7 rounded-md border bg-background px-2 text-[0.8rem] font-medium" onChange={(event) => {
                    const kind = event.target.value as "rectangle" | "circle" | "triangle";
                    event.target.value = "";
                    void addElement(kind);
                  }}>
                    <option value="" disabled>도형 추가</option>
                    <option value="rectangle">사각형</option>
                    <option value="circle">원형</option>
                    <option value="triangle">삼각형</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                <button type="button" onClick={() => setPlacementId(BACKGROUND_PLACEMENT_ID)} aria-pressed={element?.kind === "background"} className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${element?.kind === "background" ? "border-foreground bg-muted" : "bg-background"}`}>배경</button>
                {slide.placements.filter((item) => item.elementId !== BACKGROUND_ELEMENT_ID).map((item) => {
                  const definition = document.elements.find((candidate) => candidate.id === item.elementId);
                  return (
                    <button type="button" key={item.id} onClick={() => setPlacementId(item.id)} aria-pressed={item.id === placement?.id} className={`max-w-44 shrink-0 rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${item.id === placement?.id ? "border-foreground bg-muted" : "bg-background"}`}>
                      <span className="block truncate font-medium">{definition?.name ?? "Element"}</span>
                      <span className="mt-0.5 block truncate text-muted-foreground">{definition?.role ?? "역할 없음"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-background shadow-sm max-lg:order-3 max-lg:min-h-[460px]" aria-label="AI 채팅 편집">
            <div className="shrink-0 border-b px-4 py-3">
              <h2 className="text-sm font-semibold">AI 채팅 편집</h2>
            </div>
            <ChatPanel editor={job.editor} activeOperation={job.activeOperation} disabled={disabled} onAction={action} />
          </aside>
        </main>
      ) : null}
    </div>
  );
}
