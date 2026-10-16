import { randomUUID } from "node:crypto";
import { getLocalDatabase } from "../../local-db/database";
import type { OpenProjectTab } from "../../content-jobs/domain/types";
import { notifyProjectsChanged } from "../../content-jobs/projects/events";
import { VideoStore } from "./store";
import { newVideoDocument, videoDocumentSchema, type VideoDocument, type VideoSnapshot } from "../domain/model";

type Session = Omit<VideoSnapshot, "canUndo" | "canRedo" | "assets"> & { undo: VideoDocument[]; redo: VideoDocument[] };
const state = globalThis as typeof globalThis & { videoSessions?: Map<string, Session>; videoTabListeners?: Set<() => void> };
const sessions = state.videoSessions ??= new Map();
const listeners = state.videoTabListeners ??= new Set();
export const videoStore = () => new VideoStore(getLocalDatabase());
const notify = () => { for (const listener of listeners) listener(); };
export function subscribeVideoTabs(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function videoTabs(): OpenProjectTab[] {
  return [...sessions.values()].map(s => ({ projectId: s.id, tabId: s.tabId, name: s.name, revision: s.revision, savedRevision: s.revision, projectType: "video" }));
}
export function hasVideo(id: string) { return sessions.has(id) || !!videoStore().get(id); }
function snapshot(s: Session): VideoSnapshot {
  return { id: s.id, tabId: s.tabId, name: s.name, revision: s.revision, document: structuredClone(s.document), assets: videoStore().assets(s.id), canUndo: s.undo.length > 0, canRedo: s.redo.length > 0 };
}
export function createVideo() {
  const s: Session = { id: randomUUID(), tabId: randomUUID(), name: "새 영상", revision: 0, document: newVideoDocument(), undo: [], redo: [] };
  sessions.set(s.id, s); notify(); return snapshot(s);
}
export function openVideo(id: string) {
  const existing = sessions.get(id);
  if (existing) return snapshot(existing);
  const saved = videoStore().get(id);
  if (!saved) throw new Error("저장된 영상을 찾을 수 없습니다.");
  const s = { ...saved, tabId: randomUUID(), undo: [], redo: [] };
  sessions.set(id, s); notify(); return snapshot(s);
}
function requireSession(id: string, tabId: unknown, revision?: unknown) {
  const s = sessions.get(id);
  if (!s || s.tabId !== tabId) throw new Error("이 탭은 종료되었습니다. 프로젝트를 다시 열어 주세요.");
  if (revision !== undefined && s.revision !== revision) throw new Error("다른 창에서 영상이 변경되었습니다. 다시 열어 최신 내용을 확인해 주세요.");
  return s;
}
export function readVideo(id: string) {
  const session = sessions.get(id);
  if (!session) throw new Error("열린 영상 탭을 찾을 수 없습니다. open_video_project로 먼저 열어 주세요.");
  return snapshot(session);
}
export function checkVideoRevision(id: string, tabId: string, revision: number) {
  requireSession(id, tabId, revision);
}
/** Commit bytes and document together before changing session revision or history. */
export function commitVideoEdit(id: string, tabId: unknown, revision: unknown, edit: (doc: VideoDocument, store: VideoStore) => VideoDocument) {
  const s = requireSession(id, tabId, revision);
  const store = videoStore();
  const document = getLocalDatabase().transaction(() => {
    const next = videoDocumentSchema.parse(edit(structuredClone(s.document), store));
    store.save(id, s.name, next, s.revision + 1);
    return next;
  })();
  s.undo.push(s.document); if (s.undo.length > 100) s.undo.shift();
  s.redo = []; s.document = document; s.revision++;
  notify(); notifyProjectsChanged(); return snapshot(s);
}
export function writeVideo(id: string, tabId: unknown, revision: unknown, value: unknown) {
  return commitVideoEdit(id, tabId, revision, () => videoDocumentSchema.parse(value));
}
export function historyVideo(id: string, tabId: unknown, revision: unknown, redo = false) {
  const s = requireSession(id, tabId, revision);
  const from = redo ? s.redo : s.undo, to = redo ? s.undo : s.redo;
  const document = from.at(-1);
  if (document) {
    videoStore().save(id, s.name, document, s.revision + 1);
    from.pop(); to.push(s.document); s.document = document; s.revision++;
    notify(); notifyProjectsChanged();
  }
  return snapshot(s);
}
export function renameVideo(id: string, name: string, tabId?: unknown) {
  const s = sessions.get(id);
  if (tabId !== undefined) requireSession(id, tabId);
  if (!name.trim() || name.trim().length > 120) throw new Error("이름을 120자 이하로 입력해 주세요.");
  videoStore().rename(id, name);
  if (s) s.name = name.trim();
  notify(); notifyProjectsChanged();
}
export function closeVideo(id: string, tabId: unknown, revision: unknown) {
  requireSession(id, tabId, revision); sessions.delete(id); notify();
}
/** Open tabs require their exact identity; closed cards use their listed saved revision. */
export function deleteVideoGuarded(id: string, tabId: unknown, revision: unknown) {
  if (!Number.isInteger(revision) || (revision as number) < 0) throw new Error("현재 revision이 필요합니다.");
  if (sessions.has(id)) requireSession(id, tabId, revision);
  else {
    if (tabId !== undefined && tabId !== null) throw new Error("이 탭은 종료되었습니다. 프로젝트 목록을 새로 확인해 주세요.");
    const saved = videoStore().get(id);
    if (!saved || saved.revision !== revision) throw new Error("프로젝트가 변경되었습니다. 목록을 새로 확인해 주세요.");
  }
  deleteVideo(id);
}
export function deleteVideo(id: string) {
  videoStore().delete(id); sessions.delete(id); notify(); notifyProjectsChanged();
}
export function cloneVideo(id: string) {
  const copyId = videoStore().clone(id); notifyProjectsChanged(); return openVideo(copyId);
}
export function uploadVideoAsset(id: string, tabId: unknown, name: string, type: string, bytes: Buffer) {
  const s = requireSession(id, tabId);
  // A user-supplied asset makes this a nonempty project; retain bytes across reopen/restart.
  if (!videoStore().get(id)) videoStore().save(id, s.name, s.document, s.revision);
  const asset = videoStore().addAsset(id, name, type, bytes);
  notifyProjectsChanged(); return asset;
}
