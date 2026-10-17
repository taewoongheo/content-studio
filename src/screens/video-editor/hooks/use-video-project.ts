"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { saveVideoProject, videoAction, openVideoProject } from "@/domains/video/client/api";
import { reflowSequence, type VideoDocument, type VideoSnapshot } from "@/domains/video/domain/model";
export function useVideoProject(initial: VideoSnapshot) {
  const [initialDocument] = useState(() => reflowSequence(initial.document));
  const [snapshot, setSnapshot] = useState(initial);
  const [document, setDocument] = useState(initialDocument);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const historyRunning = useRef(false);
  const [dirty, setDirty] = useState(false);
  const current = useRef({ snapshot: initial, document: initialDocument, dirty: false });
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disposed = useRef(false);
  const flush = useCallback(async function flush(): Promise<boolean> {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (running.current) { if (!await running.current) return false; return flush(); }
    if (!current.current.dirty) return true;
    const submitted = current.current.document;
    setSaving(true);
    const work = (async () => {
      try {
        const saved = await saveVideoProject(current.current.snapshot, submitted);
        current.current.snapshot = saved;
        current.current.dirty = current.current.document !== submitted;
        setSnapshot(saved); setDirty(current.current.dirty); setError(""); return true;
      } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); return false; }
      finally { setSaving(false); }
    })();
    running.current = work;
    const ok = await work; running.current = null;
    if (current.current.dirty && !disposed.current && !timer.current) timer.current = setTimeout(() => { timer.current = null; void flush(); }, 5000);
    if (ok && current.current.dirty) return flush();
    return ok;
  }, []);
  useEffect(() => {
    disposed.current = false;
    const unload = (event: BeforeUnloadEvent) => { if (current.current.dirty) { event.preventDefault(); event.returnValue = ""; } };
    const hide = () => { if (documentVisibilityHidden()) void flush(); };
    window.addEventListener("beforeunload", unload); window.document.addEventListener("visibilitychange", hide);
    return () => { disposed.current = true; if (timer.current) clearTimeout(timer.current); window.removeEventListener("beforeunload", unload); window.document.removeEventListener("visibilitychange", hide); };
  }, [flush]);
  function change(input: VideoDocument) {
    const next = reflowSequence(input);
    current.current.document = next; current.current.dirty = true;
    setDocument(next); setDirty(true);
    if (!timer.current) timer.current = setTimeout(() => { timer.current = null; void flush(); }, 5000);
  }
  async function history(redo = false) {
    if (historyRunning.current) return;
    historyRunning.current = true; setHistoryBusy(true);
    try {
      if (!await flush()) return;
      const saved = await videoAction(current.current.snapshot, redo ? "redo" : "undo");
      current.current = { snapshot: saved, document: reflowSequence(saved.document), dirty: false }; setSnapshot(saved); setDocument(reflowSequence(saved.document)); setDirty(false); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "되돌리지 못했습니다."); }
    finally { historyRunning.current = false; setHistoryBusy(false); }
  }
  async function reload() {
    if (running.current) await running.current;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try {
      const saved = await openVideoProject(current.current.snapshot.id);
      current.current = { snapshot: saved, document: reflowSequence(saved.document), dirty: false };
      setSnapshot(saved); setDocument(reflowSequence(saved.document)); setDirty(false); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "불러오지 못했습니다."); }
  }
  async function sync(revision: number, name: string) {
    if (revision < current.current.snapshot.revision) return;
    if (name !== current.current.snapshot.name) {
      current.current.snapshot = { ...current.current.snapshot, name };
      setSnapshot(current.current.snapshot);
    }
    if (revision === current.current.snapshot.revision || current.current.dirty || running.current || historyRunning.current) return;
    try {
      const remote = await openVideoProject(current.current.snapshot.id);
      if (disposed.current || current.current.dirty || running.current || historyRunning.current || remote.tabId !== current.current.snapshot.tabId || remote.revision <= current.current.snapshot.revision) return;
      const next = reflowSequence(remote.document);
      current.current = { snapshot: remote, document: next, dirty: false };
      setSnapshot(remote); setDocument(next); setDirty(false); setError("");
    } catch (cause) { if (!disposed.current) setError(cause instanceof Error ? cause.message : "영상 변경을 불러오지 못했습니다."); }
  }
  return { snapshot, document, change, flush, history, error, setError, saving, dirty, current, historyBusy, reload, sync };
}
function documentVisibilityHidden() { return window.document.visibilityState === "hidden"; }
