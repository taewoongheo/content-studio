import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AssetStore } from "@/lib/local-db/assets";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/lib/local-db/projects/store";
import { createBlankDocument } from "../editor/document";
import { makeElementDefinition } from "../editor/elements/factory";
import { ContentJobRegistry } from "../workflow/registry";
import { loadContentProject, saveContentProject } from "./service";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);


test("프로젝트는 시각 문서와 사용 이미지만 저장하고 새 편집 세션으로 불러온다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "content-studio-project-test-"));
  const databasePath = join(directory, "studio.sqlite");
  try {
    const database = openLocalDatabase(databasePath);
    const projects = new ContentProjectStore(database);
    const assets = new AssetStore(database);
    const image = assets.create({
      name: "스쿼트 이미지",
      description: "스쿼트 동작",
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
    });

    await saveContentProject(registry, "project-1", "운동 콘텐츠", { projects, assets });
    assert.equal(projects.get("project-1")?.assets.length, 1);
    assert.equal(assets.delete(image.id), true);
    database.close();

    const reopened = openLocalDatabase(databasePath);
    const reopenedProjects = new ContentProjectStore(reopened);
    const reopenedAssets = new AssetStore(reopened);
    const restoredRegistry = new ContentJobRegistry();
    const restored = await loadContentProject(restoredRegistry, "project-1", {
      projects: reopenedProjects,
      assets: reopenedAssets,
    });

    assert.equal(restored.id, "project-1");
    assert.equal(restored.editor.document?.aspectRatio, "4:5");
    assert.deepEqual(restoredRegistry.getRecord("project-1").editorHistory, []);
    assert.deepEqual(reopenedAssets.readImage(image.id)?.bytes, Buffer.from(pngHeader));
    assert.equal(reopenedProjects.list()[0].name, "운동 콘텐츠");
    assert.equal(reopened.pragma("user_version", { simple: true }), 4);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
