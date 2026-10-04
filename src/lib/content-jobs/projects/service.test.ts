import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/lib/local-db/projects/store";
import { createEditorImage, readEditorAsset } from "../editor/assets";
import { createBlankDocument } from "../editor/document";
import { makeElementDefinition } from "../editor/elements/factory";
import { EditorService } from "../editor/service";
import { ContentJobRegistry } from "../workflow/registry";
import { createContentProject, loadContentProject, saveContentProject } from "./service";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);


test("프로젝트는 시각 문서와 사용 이미지만 저장하고 새 편집 세션으로 불러온다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-project-test-"));
  const databasePath = join(directory, "studio.sqlite");
  try {
    const database = openLocalDatabase(databasePath);
    const projects = new ContentProjectStore(database);
    const image = createEditorImage({
      name: "스쿼트 이미지",
      type: "image/png",
      bytes: pngHeader,
    });
    const registry = new ContentJobRegistry({ createId: () => "project-1" });
    registry.add({structure:"repeating",aspectRatio:"4:5",slideCount:4,outputLanguage:"English"});
    registry.update("project-1", (job) => {
      const document = createBlankDocument({structure:"repeating",aspectRatio:"4:5",slideCount:4});
      const template = makeElementDefinition({id:"title",kind:"text"});
      document.elements.push({ ...structuredClone(template), id: "visual", name: "운동 이미지", kind: "image" });
      document.slides[0].placements.push({
        id: "visual-placement",
        elementId: "visual",
        value: image.id,
        frameOverride: null,
        styleOverride: null,
      });
      job.editor.document = document;
      job.editorHistory.push(structuredClone(document));
      job.assets = [{ id: image.id, name: image.name, type: image.type, size: image.size }];
      job.imageData[image.id] = image.bytes;
    });

    await saveContentProject(registry, "project-1", "운동 콘텐츠", { projects });
    assert.equal(projects.get("project-1")?.assets.length, 1);
    const service = new EditorService(registry);
    const edited = service.applyCommands("project-1", [{ type: "rename_slide", slideId: "slide-1", name: "저장 후 수정" }], 0);
    const history = registry.getRecord("project-1").editorHistory;
    const reloaded = await loadContentProject(registry, "project-1", { projects });
    assert.deepEqual(reloaded, edited);
    assert.equal(registry.getRecord("project-1").editorHistory, history);
    assert.equal(service.undo("project-1", reloaded.editor.revision).editor.revision, 2);
    database.close();

    const reopened = openLocalDatabase(databasePath);
    const reopenedProjects = new ContentProjectStore(reopened);
    const restoredRegistry = new ContentJobRegistry();
    const restored = await loadContentProject(restoredRegistry, "project-1", {
      projects: reopenedProjects,
    });

    assert.equal(restored.id, "project-1");
    assert.equal(restored.editor.document?.aspectRatio, "4:5");
    assert.deepEqual(restoredRegistry.getRecord("project-1").editorHistory, []);
    assert.deepEqual((await readEditorAsset(restoredRegistry, "project-1", image.id)).bytes, Buffer.from(pngHeader));
    const clone = createContentProject(restoredRegistry, { sourceProjectId: "project-1" }, { projects: reopenedProjects });
    saveContentProject(restoredRegistry, clone.id, "복제본", { projects: reopenedProjects });
    restoredRegistry.getRecord("project-1").imageData[image.id][0] = 0;
    assert.deepEqual((await readEditorAsset(restoredRegistry, clone.id, image.id)).bytes, Buffer.from(pngHeader));
    reopenedProjects.delete("project-1");
    restoredRegistry.remove("project-1");
    const isolated = loadContentProject(new ContentJobRegistry(), clone.id, { projects: reopenedProjects });
    assert.equal(isolated.assets.length, 1);
    assert.deepEqual(reopenedProjects.get(clone.id)?.assets[0].bytes, Buffer.from(pngHeader));
    assert.equal(reopenedProjects.list()[0].name, "복제본");
    assert.equal(reopened.pragma("user_version", { simple: true }), 5);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
