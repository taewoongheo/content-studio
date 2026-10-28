import { createArtworkImageLoader } from "../../rendering/assets";
import { readSavedDocument } from "../projects-api";
import type { SavedProjectSummary } from "../../domain/projects";
import type { EditorDocument } from "../../editor/types";

/** Scoped to a preview/list mount. Share in-flight reads and bound retained documents/images. */
export function createSavedPreviewResources(read = readSavedDocument) {
  const documents = new Map<string, { promise: Promise<EditorDocument>; controller: AbortController; bytes: number }>();
  const loadImage = createArtworkImageLoader({ maxBytes: 24 * 1024 * 1024, maxEntries: 40 });
  let bytes = 0;
  const lanes: Promise<void>[] = [Promise.resolve(), Promise.resolve()];
  let lane = 0;
  return {
    loadImage,
    read(project: Pick<SavedProjectSummary, "id" | "updatedAt">) {
      const key = `${project.id}:${project.updatedAt}`;
      const existing = documents.get(key);
      if (existing) {
        documents.delete(key); documents.set(key, existing);
        return existing.promise;
      }
      const controller = new AbortController();
      const pending = read(project.id, controller.signal);
      const entry = { controller, bytes: 0, promise: pending };
      entry.promise = pending.then(document => {
        if (documents.get(key) === entry) {
          entry.bytes = JSON.stringify(document).length * 2;
          bytes += entry.bytes;
          for (const [oldKey, old] of documents) {
            if (bytes <= 8 * 1024 * 1024 && documents.size <= 20) break;
            if (!old.bytes) continue; // Never evict a shared in-flight request.
            bytes -= old.bytes; documents.delete(oldKey);
          }
        }
        return document;
      }).catch(error => {
        if (documents.get(key) === entry) documents.delete(key);
        throw error;
      });
      documents.set(key, entry);
      return entry.promise;
    },
    render<T>(signal: AbortSignal, run: () => Promise<T>): Promise<T> {
      const index = lane++ % lanes.length;
      const result = lanes[index].then(() => { signal.throwIfAborted(); return run(); });
      lanes[index] = result.then(() => undefined, () => undefined);
      return result;
    },
    clear() {
      documents.forEach(entry => entry.controller.abort());
      documents.clear(); bytes = 0;
    },
  };
}
export type SavedPreviewResources = ReturnType<typeof createSavedPreviewResources>;
