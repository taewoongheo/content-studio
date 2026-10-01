import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AssetStore } from "@/lib/local-db/assets";
import { openLocalDatabase } from "@/lib/local-db/database";
import { ContentProjectStore } from "@/lib/local-db/projects/store";
import { createDocumentFromAnalysis } from "../editor/document";
import { analysis, input } from "../editor/workflow/orchestration/tests/fixtures";
import { ContentJobRegistry } from "../workflow/registry";
import { ContentWorkflowService } from "../workflow/workflow";
import { loadContentProject, saveContentProject } from "./service";

const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class FakeCodexClient {
  async connect() {
    return { status: "connected" as const, message: "연결됨" };
  }

  async startThread() {
    return { threadId: "fresh-thread" };
  }

  async runStructuredTurn(): Promise<never> {
    throw new Error("이 테스트에서는 AI turn을 실행하지 않습니다.");
  }
}

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
    registry.add(input, "old-thread");
    registry.update("project-1", (job) => {
      const document = createDocumentFromAnalysis(analysis, "repeating", 4, "4:5");
      const template = document.elements.find((element) => element.id === "title")!;
      document.elements.push({ ...structuredClone(template), id: "visual", name: "운동 이미지", kind: "image" });
      document.slides[0].placements.push({
        id: "visual-placement",
        elementId: "visual",
        value: image.id,
        frameOverride: null,
        styleOverride: null,
      });
      job.editor.status = "ready";
      job.editor.document = document;
      job.editor.messages.push({ id: "message-1", role: "user", text: "저장되면 안 되는 대화" });
      job.editorHistory.push({
        document: structuredClone(document),
        selectedTopic: null,
        bodyReady: false,
        hookSuggestions: [],
        selectedHookId: null,
        proposalSets: [],
      });
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
    const workflow = new ContentWorkflowService(new FakeCodexClient(), restoredRegistry, { cwd: directory });
    const restored = await loadContentProject(workflow, "project-1", "gpt-6-luna", {
      projects: reopenedProjects,
      assets: reopenedAssets,
    });

    assert.equal(restored.id, "project-1");
    assert.equal(restored.editor.document?.aspectRatio, "4:5");
    assert.deepEqual(restored.editor.messages, []);
    assert.deepEqual(restored.editor.proposalSets, []);
    assert.equal(restoredRegistry.getRecord("project-1").threadId, "fresh-thread");
    assert.deepEqual(restoredRegistry.getRecord("project-1").editorHistory, []);
    assert.deepEqual(reopenedAssets.readImage(image.id)?.bytes, Buffer.from(pngHeader));
    assert.equal(reopenedProjects.list()[0].name, "운동 콘텐츠");
    assert.equal(reopened.pragma("user_version", { simple: true }), 4);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
