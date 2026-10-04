"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Plus, Trash2, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";
import type { EditorCommand, ElementFrame, ElementKind } from "@/lib/content-jobs/editor/types";
import { makeElementDefinition } from "@/lib/content-jobs/editor/elements/factory";
import { slideActionCommand } from "@/lib/content-jobs/editor/slides/commands";
import { BACKGROUND_ELEMENT_ID, BACKGROUND_PLACEMENT_ID, ensureSharedBackground, getDuplicateTargets } from "@/lib/content-jobs/editor/document";
import { attachStoredEditorImage, getContentJob, uploadEditorImage } from "@/screens/content-job/api";
import { useContentJob } from "@/screens/content-job/use-content-job";
import { ElementInspector, type ElementInspectorHandle } from "./components/inspector/element-inspector";
import { ElementScopePicker } from "./components/element-scope-picker";
import { removalCommandsForScope, selectVisualSlides, type ScopeChoice } from "./components/element-scope";
import { SlideCanvas } from "./components/canvas/slide-canvas";
import { frameForDroppedImage } from "./components/canvas/frame/geometry";
import { SlideBackground } from "./components/inspector/slide-background";
import { frameCommandsForScope } from "./components/canvas/frame/commands";
import { ImageLibraryPicker } from "./components/library/image-library-picker";
import { ProjectSaveControl, type ProjectSaveHandle } from "./components/projects/project-save-control";
import { ExportControl } from "./components/export/export-control";
import { resolveEditorSelection } from "./editor-selection";
import { SlideTabs } from "./components/slides/slide-tabs";
import { ElementLayers } from "./components/layers/element-layers";
import { createClipboardQueue, copyElement, pasteElement, type ElementClipboard } from "./components/clipboard/element-clipboard";
import { useEditorShortcuts } from "./components/shortcuts/use-editor-shortcuts";
import { ProjectPromptCopyButton } from "@/screens/projects/components/project-prompt-copy-button";

async function readImageAspectRatio(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width / bitmap.height;
    bitmap.close();
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  } catch {
    return 1;
  }
}

function aspectRatioNumber(value: "4:5" | "1:1" | "9:16") {
  const [width, height] = value.split(":").map(Number);
  return width / height;
}

export function EditorScreen({ initialJob, initialProjectName, onNewJob }: {
  initialJob: ContentJobSnapshot;
  initialProjectName?: string;
  onNewJob: () => void;
}) {
  const { job, submitting, clientError, send } = useContentJob(initialJob);
  const [slideId, setSlideId] = useState("slide-1");
  const [placementId, setPlacementId] = useState<string | null>(null);
  const [scopeSelection, setScopeSelection] = useState<{ key: string; slideIds: string[] } | null>(null);
  const [imageError, setImageError] = useState("");
  const [dismissedIssue, setDismissedIssue] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [unlockedImageRatios, setUnlockedImageRatios] = useState<Set<string>>(() => new Set());
  const inspectorRef = useRef<ElementInspectorHandle>(null);
  const projectSaveRef = useRef<ProjectSaveHandle>(null);
  const imageLibraryButtonRef = useRef<HTMLButtonElement>(null);
  const latestRevision = useRef(job.editor.revision);
  const commandQueue = useRef<Promise<unknown>>(Promise.resolve());
  const clipboard = useRef<ElementClipboard | null>(null);
  const [enqueueClipboard] = useState(createClipboardQueue);
  const latestDocument = useRef(job.editor.document);
  useEffect(() => {
    latestRevision.current = Math.max(latestRevision.current, job.editor.revision);
    latestDocument.current = job.editor.document;
  }, [job.editor.revision, job.editor.document]);
  const document = useMemo(() => job.editor.document
    ? ensureSharedBackground(structuredClone(job.editor.document)) : null, [job.editor.document]);
  const { slide, placement, element, appliedSlides, scopeSlides, visualTargets, scopeKey, selectedSlideIds } =
    resolveEditorSelection(document, slideId, placementId, scopeSelection);
  const disabled = submitting;
  const issue = clientError || imageError;
  const imageRatioKey = element?.kind === "image" ? element.id : "";
  const imageAspectRatioLocked = Boolean(imageRatioKey) && !unlockedImageRatios.has(imageRatioKey);

  function changeImageAspectRatioLocked(locked: boolean) {
    if (!imageRatioKey) return;
    setUnlockedImageRatios((current) => {
      const next = new Set(current);
      if (locked) next.delete(imageRatioKey);
      else next.add(imageRatioKey);
      return next;
    });
  }

  async function action(body: Record<string, unknown>) {
    setDismissedIssue(null);
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
        latestDocument.current = updated.editor.document;
        return true;
      } catch {
        setDismissedIssue(null);
        return false;
      }
    });
    commandQueue.current = pending.then(() => undefined);
    return pending;
  }

  async function uploadImage(file: File) {
    if (!slide || !placement) return false;
    setImageError("");
    setDismissedIssue(null);
    try {
      if (inspectorRef.current && !(await inspectorRef.current.flushPending())) return false;
      const updated = await uploadEditorImage(job.id, file);
      const asset = updated.assets.at(-1);
      if (!asset) throw new Error("업로드한 이미지를 찾을 수 없습니다.");
      latestRevision.current = Math.max(latestRevision.current, updated.editor.revision);
      return saveCommands([{ type: "set_slot_value", slideId: slide.id, placementId: placement.id, value: asset.id }]);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "이미지를 추가하지 못했습니다.");
      return false;
    }
  }

  async function addElement(kind: Exclude<ElementKind, "background">, imageAssetId?: string, initialFrame?: ElementFrame) {
    if (!slide) return false;
    const id = crypto.randomUUID();
    const newPlacementId = crypto.randomUUID();
    const createdElement = makeElementDefinition({ id, kind,  });
    const newElement = initialFrame ? { ...createdElement, frame: initialFrame } : createdElement;
    const saved = await saveCommands([
      { type: "add_element", element: newElement },
      { type: "place_element", slideId: slide.id, elementId: id, placementId: newPlacementId },
      ...(imageAssetId ? [{ type: "set_slot_value" as const, slideId: slide.id, placementId: newPlacementId, value: imageAssetId }] : []),
    ]);
    if (saved) setPlacementId(newPlacementId);
    return saved;
  }

  async function addStoredImage(assetId: string) {
    setImageError("");
    setDismissedIssue(null);
    try {
      const updated = await attachStoredEditorImage(job.id, assetId);
      latestRevision.current = Math.max(latestRevision.current, updated.editor.revision);
      return addElement("image", assetId);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "저장된 이미지를 추가하지 못했습니다.");
      return false;
    }
  }

  async function addDroppedImage(file: File, center: { x: number; y: number }) {
    if (!document || !slide) return false;
    setImageError("");
    setDismissedIssue(null);
    try {
      if (inspectorRef.current && !(await inspectorRef.current.flushPending())) return false;
      const existingAssetIds = new Set(job.assets.map((asset) => asset.id));
      const [updated, imageAspectRatio] = await Promise.all([
        uploadEditorImage(job.id, file),
        readImageAspectRatio(file),
      ]);
      const asset = updated.assets.find((candidate) => !existingAssetIds.has(candidate.id));
      if (!asset) throw new Error("업로드한 이미지를 찾을 수 없습니다.");
      latestRevision.current = Math.max(latestRevision.current, updated.editor.revision);
      const frame = frameForDroppedImage(center, imageAspectRatio, aspectRatioNumber(document.aspectRatio));
      return addElement("image", asset.id, frame);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "이미지를 추가하지 못했습니다.");
      return false;
    }
  }

  async function addSlide(copyContent: boolean) {
    if (!document || !slide) return;
    const newSlideId = crypto.randomUUID();
    const command = slideActionCommand(document, slide.id,
      copyContent ? "duplicate_slide" : "add_slide", newSlideId);
    if (await saveCommands([command])) {
      setSlideId(newSlideId);
      setPlacementId(null);
    }
  }

  async function removeSlide() {
    if (!document || !slide) return;
    const index = document.slides.findIndex((item) => item.id === slide.id);
    if (await saveCommands([slideActionCommand(document, slide.id, "remove_slide")])) {
      setSlideId(document.slides[index + 1]?.id ?? document.slides[index - 1].id);
      setPlacementId(null);
    }
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

  async function handleClipboard(action: "copy" | "paste") {
    if (!slide || !placement) return;
    if (!disabled && inspectorRef.current && !(await inspectorRef.current.flushPending())) return;
    await commandQueue.current;
    const current = latestDocument.current;
    if (!current) return;
    if (action === "copy") {
      clipboard.current = copyElement(current, slide.id, placement.id, selectedSlideIds);
      return;
    }
    if (!clipboard.current) return;
    const pasted = pasteElement(current, clipboard.current, slide.id, () => crypto.randomUUID());
    if (pasted && await saveCommands(pasted.commands)) setPlacementId(pasted.destinationPlacementId);
  }

  useEditorShortcuts((shortcut) => {
    if (!document || (disabled && shortcut !== "copy")) return false;
    if (shortcut === "undo") {
      void action({ action: "editor_undo" });
      return true;
    }
    if (!slide || !placement) return false;
    if (shortcut === "copy") {
      // Make the snapshot available synchronously so an immediate Cmd+V is accepted.
      const copied = copyElement(document, slide.id, placement.id, selectedSlideIds);
      if (!copied) return false;
      clipboard.current = copied;
    } else if (!clipboard.current) return false;
    void enqueueClipboard(() => handleClipboard(shortcut)).catch(() => {
      setDismissedIssue(null);
      setImageError("Element 복사·붙여넣기에 실패했습니다.");
    });
    return true;
  });

  async function removeElement() {
    if (!placement || element?.kind === "background") return;
    const commands = removalCommandsForScope(visualTargets, selectedSlideIds);
    if (commands.length === 0) return;
    const saved = await saveCommands(commands);
    if (saved) setPlacementId(null);
  }

  async function changeVisualScope(choice: ScopeChoice) {
    if (!slide || !placement) return;
    const next = selectVisualSlides(slide.id, scopeSlides.map((item) => item.slideId), selectedSlideIds, choice);
    if (next.join() === selectedSlideIds.join()) return;
    if (!disabled && inspectorRef.current && !(await inspectorRef.current.flushPending())) return;
    setScopeSelection({ key: scopeKey, slideIds: next });
  }

  async function changeFrame(targetPlacementId: string, frame: ElementFrame) {
    if (!slide || !placement || !element || placement.id !== targetPlacementId || element.kind === "background") return false;
    if (inspectorRef.current && !(await inspectorRef.current.flushPending())) return false;
    const commands = frameCommandsForScope(element.id, frame, visualTargets, selectedSlideIds);
    return commands.length === 0 || saveCommands(commands);
  }

  async function prepareExport() {
    if (!(await projectSaveRef.current?.saveAutomatically())) return null;
    return (await getContentJob(job.id)).editor.document;
  }

  return (
    <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-background text-foreground max-lg:h-auto max-lg:min-h-svh max-lg:overflow-visible">
      <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-b px-3 py-1.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onNewJob} aria-label="새 작업으로 돌아가기"><ArrowLeft className="size-4" /></Button>
          <h1 className="truncate text-sm font-semibold">Content Studio <span className="font-normal text-muted-foreground">/ 슬라이드 편집기</span></h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <ProjectPromptCopyButton projectId={job.id} size="sm" disabled={disabled || !document}
            onBeforeCopy={async () => {
              if (inspectorRef.current && !(await inspectorRef.current.flushPending())) return false;
              await commandQueue.current;
              return true;
            }} />
          <label className="flex items-center gap-2 text-xs">
            <span className="sr-only">화면 비율</span>
            <select aria-label="화면 비율" value={document?.aspectRatio ?? "4:5"} disabled={disabled}
              className="h-8 rounded-md border bg-background px-2"
              onChange={(event) => { void saveCommands([{ type: "set_aspect_ratio", aspectRatio: event.target.value as "4:5" | "1:1" | "9:16" }]); }}>
              <option value="4:5">4:5 · 1080 × 1350</option>
              <option value="9:16">9:16 · 1080 × 1920</option>
              <option value="1:1">1:1 · 1080 × 1080</option>
            </select>
            <span>{job.slideCount}장</span>
          </label>
          <ProjectSaveControl ref={projectSaveRef} jobId={job.id} revision={job.editor.revision}
            currentProjectName={job.name} persistedRevision={job.savedRevision}
            getRevision={() => latestRevision.current}
            defaultName="새 콘텐츠"
            initialProjectName={initialProjectName} disabled={disabled || !document}
            onBeforeSave={async () => {
              if (inspectorRef.current && !(await inspectorRef.current.flushPending())) return false;
              await commandQueue.current;
              return true;
            }} />
          {document && <ExportControl jobId={job.id} disabled={disabled}
            onBeforeExport={prepareExport} onError={(message) => { setDismissedIssue(null); setImageError(message); }} />}
          <Button variant="outline" size="sm" disabled={disabled || !document} title="되돌리기 (⌘Z)" onClick={() => void action({ action: "editor_undo" })}>
            <Undo2 className="size-4" aria-hidden="true" /> 되돌리기
          </Button>
        </div>
      </header>

      {issue && issue !== dismissedIssue && <div role="alert" className="mx-5 mt-4 flex shrink-0 items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <p className="min-w-0 flex-1 break-words">{issue}</p>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="오류 메시지 닫기"
          className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDismissedIssue(issue)}><X className="size-4" aria-hidden="true" /></Button>
      </div>}

      {document && slide ? (
        <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-background lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(220px,260px)] 2xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(260px,300px)] max-lg:overflow-visible">
          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r px-4 py-4 max-lg:order-2 max-lg:min-h-[360px] max-lg:border-r-0 max-lg:border-t" aria-label="선택 항목 편집">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {element?.kind === "background" && placement ? (
                <SlideBackground
                  key={`${scopeKey}:${selectedSlideIds.join(",")}`}
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
                  jobId={job.id}
                  currentImage={job.assets.find((asset) => asset.id === placement.value) ?? null}
                  imageAspectRatioLocked={imageAspectRatioLocked}
                  disabled={disabled}
                  onSave={saveCommands}
                  onUploadImage={uploadImage}
                  onImageAspectRatioLockedChange={changeImageAspectRatioLocked}
                />
              ) : null}
            </div>
          </aside>

          <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l px-3 py-3 lg:col-start-3 lg:row-start-1 max-lg:order-2 max-lg:h-80 max-lg:border-l-0 max-lg:border-t" aria-label="Element 레이어">
              {showImageLibrary && <ImageLibraryPicker anchorRef={imageLibraryButtonRef} disabled={disabled}
                onSelect={(asset) => addStoredImage(asset.id)}
                onAddEmpty={() => addElement("image")}
                onClose={() => { setShowImageLibrary(false); imageLibraryButtonRef.current?.focus(); }} />}
              <div className="flex shrink-0 flex-col items-stretch gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">Element</h2>
                  {element && placement && <ElementScopePicker
                    key={scopeKey}
                    currentSlideId={slide.id}
                    slides={scopeSlides}
                    selectedSlideIds={selectedSlideIds}
                    isBackground={element.kind === "background"}
                    disabled={false}
                    onChange={changeVisualScope}
                  />}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {element && placement && element.kind !== "background" && <div className="mr-1 flex items-center gap-1.5 border-r pr-2">
                    <Button size="sm" variant="outline" disabled={disabled} onClick={() => void duplicateElement()} aria-label={`선택한 ${selectedSlideIds.length}장에서 ${element.name} 복제`}><Copy className="size-3.5" aria-hidden="true" /> 복제</Button>
                    <Button size="icon-sm" variant="destructive" disabled={disabled} onClick={() => void removeElement()}
                      aria-label={`선택한 ${selectedSlideIds.length}장에서 ${element.name} 제거`}
                      title={`선택한 ${selectedSlideIds.length}장에서 제거`}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
                  </div>}
                  <Button size="sm" variant="outline" disabled={disabled} onClick={() => void addElement("text")}>텍스트 추가</Button>
                  <Button ref={imageLibraryButtonRef} size="sm" variant={showImageLibrary ? "secondary" : "outline"}
                    aria-expanded={showImageLibrary} aria-controls="editor-image-library"
                    onClick={() => setShowImageLibrary((current) => !current)}>이미지 추가</Button>
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
              <ElementLayers document={document} slide={slide} selectedPlacementId={placement?.id ?? null}
                selectedSlideIds={selectedSlideIds} disabled={disabled} onSelect={setPlacementId} onCommand={saveCommands} />
            </aside>

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background lg:col-start-2 lg:row-start-1 max-lg:order-1 max-lg:min-h-[620px] max-lg:border-b" aria-label="슬라이드 편집 영역">
            <nav aria-label="페이지 선택" className="shrink-0 border-b px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="mr-1 text-sm font-semibold">페이지</h2>
                  <Button type="button" variant="outline" size="sm" disabled={disabled || document.slides.length >= 20}
                    onClick={() => void addSlide(false)}><Plus className="size-3.5" aria-hidden="true" /> 추가</Button>
                  <Button type="button" variant="outline" size="sm"
                    disabled={disabled || document.slides.length >= 20 || (document.structure === "repeating" && slide.role !== "body")}
                    onClick={() => void addSlide(true)}><Copy className="size-3.5" aria-hidden="true" /> 장 복제</Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive"
                    aria-label="현재 슬라이드 제거" title="현재 슬라이드 제거"
                    disabled={disabled || document.slides.length <= (document.structure === "repeating" ? 3 : 2) ||
                      (document.structure === "repeating" && slide.role !== "body")}
                    onClick={() => void removeSlide()}><Trash2 className="size-3.5" aria-hidden="true" /></Button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={showGuides}
                      onChange={(event) => setShowGuides(event.target.checked)}
                      className="size-4 accent-primary" />
                    가이드
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={showOverflow}
                      onChange={(event) => setShowOverflow(event.target.checked)}
                      className="size-4 accent-primary" />
                    잘린 영역 표시
                  </label>
                </div>
              </div>
              <SlideTabs document={document} selectedSlideId={slide.id} disabled={disabled}
                onSelect={(id) => { setSlideId(id); setPlacementId(null); }} onCommand={saveCommands} />
            </nav>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-muted/20 p-5 sm:p-6">
              <SlideCanvas key={slide.id} document={document} slide={slide} jobId={job.id}
                selectedPlacementId={placement?.id ?? null} disabled={disabled} showGuides={showGuides} showOverflow={showOverflow}
                selectionAppliesToAll={appliedSlides.length > 1 && appliedSlides.every((item) => selectedSlideIds.includes(item.slideId))}
                lockImageAspectRatio={imageAspectRatioLocked}
                onSelect={setPlacementId} onSelectBackground={() => setPlacementId(BACKGROUND_PLACEMENT_ID)}
                onFrameChange={changeFrame} onDropImage={addDroppedImage} />
            </div>

          </section>

        </main>
      ) : null}
    </div>
  );
}
