"use client";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type { PlayerRef } from "@remotion/player";
import { Copy, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appendFrame, createLayer, reorderVideoLayers, splitVideoLayer, videoDuration, type VideoLayer, type VideoSnapshot } from "@/lib/video/domain/model";
import { useVideoView } from "./hooks/use-video-view";
import { useVideoProject } from "./hooks/use-video-project";
import { downloadBlob, videoEndpoint, videoRequest } from "./api";
import { mediaLayer } from "./media";
import { VideoPreview } from "./components/canvas/video-preview";
import { VideoTimeline } from "./components/timeline/video-timeline";
import { VideoHeader } from "./components/projects/video-header";
import { VideoLayers } from "./components/layers/video-layers";
import { VideoControls } from "./components/playback/video-controls";
import { VideoInspector } from "./components/inspector";
export type VideoWorkspaceHandle = { flushPending: () => Promise<boolean> };
export function VideoScreen({ initial, ref, onNewJob }: { initial: VideoSnapshot; ref?: Ref<VideoWorkspaceHandle>; onNewJob: () => void }) {
  const project = useVideoProject(initial), { document: doc, change } = project;
  const player = useRef<PlayerRef>(null);
  const { initialFrame, frameRef, selected, setSelected, guides, setGuides, unlockedRatios, setUnlockedRatios } = useVideoView(initial.tabId, videoDuration(initial.document), player);
  const [working, setWorking] = useState(false);
  const [rendering, setRendering] = useState(false);
  const files = useRef<HTMLInputElement>(null);
  const assetMode = useRef<"sequence" | "overlay" | "image" | "audio">("sequence");
  const docRef = useRef(doc);
  const pendingSeek = useRef<number | null>(null);
  useEffect(() => {
    docRef.current = doc;
    if (pendingSeek.current !== null) { const frame = Math.min(videoDuration(doc) - 1, pendingSeek.current); pendingSeek.current = null; player.current?.seekTo(frame); frameRef.current = frame; }
  }, [doc, frameRef]);
  const clipboard = useRef<VideoLayer | null>(null);
  const currentWork = useRef<Promise<void> | null>(null);
  const currentExport = useRef<Promise<void> | null>(null);
  const selectedLayer = doc.layers.find(l => l.id === selected);
  useImperativeHandle(ref, () => ({ flushPending: async () => {
    try { await currentWork.current; await currentExport.current; } catch { return false; }
    return project.flush();
  } }));
  const currentFrame = useCallback(() => player.current?.getCurrentFrame() ?? frameRef.current, [frameRef]);
  function seek(n: number) { player.current?.seekTo(n); frameRef.current = n; }
  function updateLayer(layer: VideoLayer) {
    const latest = docRef.current, before = latest.layers.find(l => l.id === layer.id);
    let layers = latest.layers.map(l => l.id === layer.id ? layer : l);
    if (layer.kind === "video" && layer.sequence && before && layer.from !== before.from && layer.duration === before.duration) {
      const sequence = latest.layers.filter(l => l.kind === "video" && l.sequence && l.id !== layer.id).sort((a,b) => a.from - b.from);
      const at = sequence.findIndex(l => layer.from < l.from + l.duration / 2);
      sequence.splice(at < 0 ? sequence.length : at, 0, layer);
      const order = new Map(sequence.map((l, index) => [l.id, index]));
      layers = layers.map(l => order.has(l.id) ? { ...l, sequenceIndex: order.get(l.id)! } : l);
    }
    change({ ...latest, layers });
  }
  function selectLayer(id: string | null) {
    setSelected(id);
    const layer = docRef.current.layers.find(l => l.id === id);
    if (layer && (currentFrame() < layer.from || currentFrame() >= layer.from + layer.duration)) seek(layer.from);
  }
  function add(kind: "text" | "shape", shape?: "rectangle" | "ellipse" | "triangle" | "line") { const l = createLayer(kind, docRef.current, currentFrame()); if (l.kind === "shape" && shape) l.shape = shape; change({ ...docRef.current, layers: [...docRef.current.layers, l] }); setSelected(l.id); }
  function remove() { if (selected) { change({ ...docRef.current, layers: docRef.current.layers.filter(l => l.id !== selected) }); setSelected(null); } }
  function duplicate() { if (!selectedLayer) return; const l = { ...selectedLayer, id: crypto.randomUUID(), name: `${selectedLayer.name.slice(0, 115)} 복사본` }; change({ ...docRef.current, layers: [...docRef.current.layers, l] }); setSelected(l.id); }
  function split() {
    if (!selectedLayer) return; const pair = splitVideoLayer(selectedLayer, currentFrame());
    if (!pair) return; change({ ...doc, layers: doc.layers.flatMap(l => l.id === selected ? pair : [l]) }); setSelected(pair[1].id);
  }
  async function run(work: () => Promise<void>) {
    if (currentWork.current) return;
    setWorking(true); project.setError("");
    const promise = work(); currentWork.current = promise;
    try { await promise; } catch (e) { project.setError(e instanceof Error ? e.message : "작업에 실패했습니다."); }
    finally { currentWork.current = null; setWorking(false); }
  }
  async function addFiles(list: File[], mode = assetMode.current) {
    await run(async () => {
      for (const file of list) {
        const latest = docRef.current;
        const from = mode === "sequence" ? appendFrame(latest) : currentFrame();
        const l = await mediaLayer(file, latest, project.current.current.snapshot, from, mode === "overlay" || mode === "image");
        const next = { ...docRef.current, duration: docRef.current.layers.length === 0 && mode === "sequence" ? 1 : docRef.current.duration, layers: [...docRef.current.layers, l] }; docRef.current = next; pendingSeek.current = l.from; change(next); setSelected(l.id);
      }
      if (!await project.flush()) throw new Error("미디어를 추가했지만 프로젝트를 저장하지 못했습니다. 저장을 다시 시도해 주세요.");
    });
  }
  function pick(mode: typeof assetMode.current) { assetMode.current = mode; if (files.current) { files.current.accept = mode === "audio" ? "audio/*" : mode === "image" ? "image/png,image/jpeg,image/webp" : "video/*"; files.current.click(); } }
  async function exportMp4() {
    if (!await project.flush()) return;
    setRendering(true); project.setError("");
    const work = (async () => {
      const s = project.current.current.snapshot;
      const response = await fetch(`${videoEndpoint(s.id)}/render`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedTabId: s.tabId, expectedRevision: s.revision }) });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error ?? "내보내기에 실패했습니다."); }
      downloadBlob(await response.blob(), `${s.name}.mp4`);
    })();
    currentExport.current = work;
    try { await work; } catch (e) { project.setError(e instanceof Error ? e.message : "내보내기에 실패했습니다."); }
    finally { currentExport.current = null; setRendering(false); }
  }
  const actions = useRef({ remove, duplicate, project, run, selectedLayer, working: working || project.historyBusy });
  useEffect(() => { actions.current = { remove, duplicate, project, run, selectedLayer, working: working || project.historyBusy }; });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const a = actions.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (!a.working) void a.project.flush(); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement || (e.target instanceof HTMLElement && e.target.isContentEditable)) return;
      if (a.working || window.document.querySelector("[role=dialog]")) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); void a.run(() => a.project.history(e.shiftKey)); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") { e.preventDefault(); a.duplicate(); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && a.selectedLayer) { e.preventDefault(); clipboard.current = structuredClone(a.selectedLayer); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v" && clipboard.current) {
        e.preventDefault(); const layer = { ...structuredClone(clipboard.current), id: crypto.randomUUID() };
        a.project.change({ ...a.project.current.current.document, layers: [...a.project.current.current.document.layers, layer] }); setSelected(layer.id);
      }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); a.remove(); }
      else if (e.code === "Space") { e.preventDefault(); player.current?.toggle(); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [setSelected]);
  const disabled = working || project.historyBusy;
  return <div aria-busy={working} data-tab-id={initial.tabId} className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground max-lg:h-auto max-lg:min-h-svh max-lg:overflow-visible" onDragOver={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }} onDrop={e => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}>
    <input ref={files} type="file" multiple hidden onChange={e => { const list = Array.from(e.target.files ?? []); e.target.value = ""; void addFiles(list); }} />
    <VideoHeader id={initial.id} name={project.snapshot.name} document={doc} disabled={disabled} dirty={project.dirty} saving={project.saving} working={working} rendering={rendering}
      canUndo={project.snapshot.canUndo || project.dirty} canRedo={project.snapshot.canRedo} onBack={onNewJob} onChange={change} onSave={() => void project.flush()}
      onUndo={() => void run(() => project.history())} onRedo={() => void run(() => project.history(true))}
      onImport={() => { assetMode.current = "sequence"; if (files.current) { files.current.accept = "video/mp4,.mp4"; files.current.click(); } }} onMp4={() => void exportMp4()} onDelete={async () => { await videoRequest(videoEndpoint(initial.id), "DELETE"); }} />
    {project.error && <div role="alert" className="mx-5 mt-4 flex shrink-0 flex-wrap items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><p className="min-w-0 flex-1 break-words">{project.error}</p><Button variant="outline" size="sm" onClick={() => void project.flush()}>저장 재시도</Button><Button variant="outline" size="sm" onClick={() => { if (window.confirm("현재 편집 내용을 버리고 서버의 최신 내용을 불러올까요?")) void run(() => project.reload()); }}>최신 내용 불러오기</Button></div>}
    <main inert={disabled} className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-background lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(220px,260px)] 2xl:grid-cols-[minmax(260px,300px)_minmax(0,1fr)_minmax(260px,300px)] max-lg:overflow-visible">
      <aside aria-label="선택 항목 편집" className="flex min-h-0 min-w-0 flex-col overflow-hidden border-r px-4 py-4 max-lg:order-2 max-lg:min-h-[360px] max-lg:border-r-0 max-lg:border-t">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain"><VideoInspector document={doc} layer={selectedLayer} onDocument={change} onLayer={updateLayer} player={player} initialFrame={initialFrame} onSplit={split}
          aspectRatioLocked={!selected || !unlockedRatios.includes(selected)} onAspectRatioLockedChange={locked => { if (selected) setUnlockedRatios(ids => locked ? ids.filter(id => id !== selected) : [...new Set([...ids, selected])]); }} /></div>
      </aside>
      <aside aria-label="Element 레이어" className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l px-3 py-3 lg:col-start-3 lg:row-start-1 max-lg:order-2 max-lg:h-80 max-lg:border-l-0 max-lg:border-t">
        <div className="flex shrink-0 flex-col items-stretch gap-3">
          <div className="flex items-center gap-2"><h2 className="text-sm font-semibold">Element</h2><span className="text-xs text-muted-foreground">{doc.layers.length}</span><span className="sr-only">레이어 · {doc.layers.length}</span></div>
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedLayer && <div className="mr-1 flex items-center gap-1.5 border-r pr-2"><Button size="sm" variant="outline" disabled={disabled} onClick={duplicate} aria-label={`${selectedLayer.name} 복제`}><Copy className="size-3.5" />복제</Button><Button size="icon-sm" variant="destructive" disabled={disabled} onClick={remove} aria-label={`${selectedLayer.name} 제거`} title="선택 항목 제거"><Trash2 className="size-3.5" /></Button></div>}
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => add("text")}>텍스트 추가</Button>
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => pick("image")}>이미지 추가</Button>
            <label className="sr-only" htmlFor={`video-add-shape-${initial.tabId}`}>도형 추가</label><select id={`video-add-shape-${initial.tabId}`} defaultValue="" disabled={disabled} className="h-7 rounded-md border bg-background px-2 text-[0.8rem] font-medium" onChange={e => { const shape = e.target.value as "rectangle" | "ellipse" | "triangle" | "line"; e.target.value = ""; add("shape", shape); }}><option value="" disabled>도형 추가</option><option value="rectangle">사각형</option><option value="ellipse">원형</option><option value="triangle">삼각형</option><option value="line">선</option></select>
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => pick("overlay")}>영상 추가</Button>
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => pick("sequence")}>영상 이어붙이기</Button>
            <Button size="sm" variant="outline" disabled={disabled} onClick={() => pick("audio")}>오디오 추가</Button>
          </div>
        </div>
        <VideoLayers layers={doc.layers} selected={selected} disabled={disabled} onSelect={selectLayer} onReorder={(active, over) => change(reorderVideoLayers(docRef.current, active, over))} />
      </aside>
      <section aria-label="영상 편집 영역" className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background lg:col-start-2 lg:row-start-1 max-lg:order-1 max-lg:min-h-[620px] max-lg:border-b">
        <VideoPreview document={doc} projectId={initial.id} player={player} initialFrame={initialFrame} selected={selected} guides={guides} unlockedRatios={unlockedRatios} onSelect={setSelected} onChange={updateLayer} onFiles={list => void addFiles(list, "overlay")} />
        <VideoControls player={player} initialFrame={initialFrame} duration={videoDuration(doc)} fps={doc.fps} guides={guides} onGuides={setGuides} onSeek={seek} />
        <VideoTimeline document={doc} player={player} initialFrame={initialFrame} selected={selected} onSelect={selectLayer} onSeek={seek} onChange={updateLayer} />
      </section>
    </main>
  </div>;
}
