import { open } from "node:fs/promises";
import { basename, isAbsolute } from "node:path";
import { MAX_UPLOAD_IMAGE_BYTES, imageTypes, validSignature } from "@/lib/content-jobs/http/upload";
import { ContentJobError, type ContentJobRegistry } from "@/lib/content-jobs/workflow/registry";
import { EditorService } from "@/lib/content-jobs/editor/service";
import type { EditorCommand } from "@/lib/content-jobs/editor/types";
import { validateEditorCommands } from "@/lib/content-jobs/editor/schema";
import { applyEditorCommands } from "@/lib/content-jobs/editor/document";
import { AssetStore } from "@/lib/local-db/assets";
import type Database from "better-sqlite3";
import type { ContentJobSnapshot } from "@/lib/content-jobs/domain/types";

export type LocalImageCommand = { type: "set_local_image"; slideId: string; placementId: string; localPath: string };
export async function readLocalImage(localPath: string) {
  if (!isAbsolute(localPath)) throw new Error("localPath에는 로컬 절대 경로가 필요합니다.");
  const file = await open(localPath, "r");
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size < 1 || info.size > MAX_UPLOAD_IMAGE_BYTES)
      throw new Error("PNG, JPG, WebP 파일을 10MB 이하로 지정해 주세요.");
    const bytes = Buffer.alloc(MAX_UPLOAD_IMAGE_BYTES + 1);
    let length = 0;
    while (length < bytes.length) {
      const read = await file.read(bytes, length, bytes.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length > MAX_UPLOAD_IMAGE_BYTES) throw new Error("이미지는 10MB 이하이어야 합니다.");
    const data = bytes.subarray(0, length);
    const type = (Object.keys(imageTypes) as Array<keyof typeof imageTypes>).find((mime) => validSignature(mime, data));
    if (!type) throw new Error("PNG, JPG, WebP 이미지 파일이 필요합니다.");
    return { bytes: data, type, name: basename(localPath) };
  } finally { await file.close(); }
}

/** Prepare files first; roll back new DB assets if the command batch fails. */
export async function editWithLocalImages(registry: ContentJobRegistry, database: Database.Database,
  projectId: string, commands: Array<EditorCommand | LocalImageCommand>, revision: number,
  commit: (apply: () => ContentJobSnapshot) => ContentJobSnapshot = (apply) => apply()) {
  const job = registry.get(projectId);
  if (job.editor.revision !== revision)
    throw new ContentJobError("INVALID_STAGE", "편집 문서가 변경되었습니다. 다시 읽어 주세요.");
  if (!commands.some((command) => command.type === "set_local_image"))
    return commit(() => new EditorService(registry).applyCommands(projectId, commands, revision));
  const prepared = new Map<string, Awaited<ReturnType<typeof readLocalImage>>>();
  for (const [index, command] of commands.entries()) {
    if (command.type !== "set_local_image") continue;
    try {
      if (!prepared.has(command.localPath)) prepared.set(command.localPath, await readLocalImage(command.localPath));
    } catch (error) {
      throw new ContentJobError("INVALID_OUTPUT", `commands[${index}] (${command.localPath}): ${error instanceof Error ? error.message : "파일 읽기 실패"}`);
    }
  }
  return commit(() => database.transaction(() => {
    registry.requireTab(projectId, job.tabId);
    const store = new AssetStore(database);
    const imported = new Map([...prepared].map(([path, image]) => [path, store.create(image)]));
    const resolved = commands.map((command): EditorCommand => command.type === "set_local_image"
      ? { type: "set_slot_value", slideId: command.slideId, placementId: command.placementId, value: imported.get(command.localPath)!.id }
      : command);
    const checked = validateEditorCommands({ commands: resolved });
    if (!checked.ok) throw new ContentJobError("INVALID_OUTPUT", checked.errors.join(" "));
    // Validate targets in command order, including newly created placements.
    const { document } = registry.get(projectId).editor;
    let probe = document;
    for (const [index, command] of resolved.entries()) {
      const original = commands[index];
      if (original.type === "set_local_image") {
        const placement = probe.slides.find((slide) => slide.id === original.slideId)?.placements
          .find((item) => item.id === original.placementId);
        if (!placement || probe.elements.find((element) => element.id === placement.elementId)?.kind !== "image")
          throw new ContentJobError("INVALID_OUTPUT", `commands[${index}]: 이미지 배치를 찾을 수 없습니다.`);
      }
      try { probe = applyEditorCommands(probe, [command]); }
      catch (error) { throw new ContentJobError("INVALID_OUTPUT", `commands[${index}]: ${error instanceof Error ? error.message : "편집 실패"}`); }
    }
    return new EditorService(registry).applyCommands(projectId, resolved, revision, [...imported.values()]);
  })());
}
