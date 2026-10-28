import { badgeRepairCommands } from "@/domains/content-production/server/execution/policy/editing/badge/repair";
import { SlideshowProjectWrites } from "@/domains/slideshow/server/project-writes";
import { stageContext } from "@/domains/content-production/server/execution/policy/context";
import type { ProjectWriteValidator } from "@/domains/slideshow/server/project-writes";
import { join } from "node:path";
import { OperationError } from "@/lib/errors/operation";
import { readFreshGeneratedImage, generatedImagesRoot } from "@/domains/content-production/server/images/generated";
import { imageExecution } from "@/domains/content-production/server/execution/runner";
import { registerSourceTools } from "./sources";
import { importSlideshowImage } from "@/domains/slideshow/server/import-image";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerTool } from "../protocol/tools";
import { annotations, guarded, json } from "../protocol/result";
import { productionStore } from "@/domains/content-production/server/execution/runner";
import { registerExternalReferenceTools } from "./references";
import {
  analysisPatchSchema,
  productionPatchSchema,
  reviewDraftPatchSchema,
  directionSchema,
} from "@/domains/content-production/domain/contracts";
import { cloneTaskProject, createTaskProject } from "@/domains/content-production/server/projects";

export function registerProductionTools(server: McpServer, taskId?: string, origin = "http://127.0.0.1:3000", validateProject?: ProjectWriteValidator) {
  registerSourceTools(server, origin);
  registerTool(
    server,
    "production_query",
    {
      description:
        "During analysis, retrieve assigned own-post IDs with ids; selection and metrics come from the material node snapshot. Query keywords do not replace that set. Production queries only that SAME assigned pool; query filters its title/topic/message/format and never expands it. In other stages, query the stored published logs by topic, title, message or format. Analysis uses five random posts from its configured high-rate pool plus five recent posts. selection_group identifies performance/recent. Missing metrics exclude rate rankings, not recency. Use production_external_references for the shared external library. Unpublished drafts are available through production_comparisons.",
      inputSchema: z.object({
        kind: z.literal("logs"),
        query: z.string().default(""),
        ids: z.array(z.string().min(1)).min(1).max(30).optional(),
      }),
      annotations: annotations(true),
    },
    (input) => guarded(() => {
      const store = productionStore();
      const step = taskId ? store.get(taskId).task.current_step : undefined;
      if (taskId && step === "production") {
        const ids = input.ids ?? store.analysisInputs(taskId).map(row=>String(row.id));
        const rows = ids.length ? store.analysisLogs(taskId,ids) : [];
        const query = input.query.toLowerCase();
        return json({items:rows.filter(row=>[row.name,row.topic,row.message,row.content_type].some(value=>String(value??"").toLowerCase().includes(query)))});
      }
      if (taskId && step === "analysis") {
        if (!input.ids) throw new Error("분석 단계에서는 전달받은 게시글 ID 목록으로 조회해 주세요.");
        return json({items:store.analysisLogs(taskId,input.ids)});
      }
      return json({items:store.logs(input.query,true).filter(row => !input.ids || input.ids.includes(String(row.id))).slice(0,30)});
    }),
  );
  registerTool(
    server,
    "production_read_images",
    {
      description:
        "Read selected stored external/published slides as images. Omitting indexes reads all slides. Use own project preview tools for current native projects.",
      inputSchema: z.object({
        set_id: z.string(),
        indexes: z.array(z.number().int().nonnegative()).optional(),
      }),
      annotations: annotations(true),
    },
    (input) =>
      guarded(() => {
        const rows = productionStore()
          .db.prepare(
            "SELECT slide_index,data FROM content_visual_slides WHERE set_id=? ORDER BY slide_index",
          )
          .all(input.set_id) as Array<{ slide_index: number; data: Buffer }>;
        if (!rows.length) throw new Error("이미지 묶음을 찾을 수 없습니다.");
        const selected = input.indexes
          ? rows.filter((r) => input.indexes!.includes(r.slide_index))
          : rows;
        if (input.indexes?.some((i) => !rows.some((r) => r.slide_index === i)))
          throw new Error("존재하지 않는 장 번호입니다.");
        return {
          content: selected.flatMap((r) => [
            { type: "text" as const, text: `slide ${r.slide_index}` },
            {
              type: "image" as const,
              mimeType: "image/webp",
              data: r.data.toString("base64"),
            },
          ]),
        };
      }),
  );
  if (!taskId) return;
  registerExternalReferenceTools(server, taskId);
  registerTool(server, "production_repair_badge", {
    description: "Visual review only. Restore all slides to the exact approved two-element LIFTCODE badge specification. Repairs legacy, missing, misplaced or locally overridden badges. Preserves other content; saves as one undoable edit. Re-read and preview ALL slides at the new revision after repair. No custom badge styles accepted.",
    inputSchema: z.object({ expectedRevision: z.number().int().nonnegative(), expectedTabId: z.string().min(1) }),
    annotations: annotations(false),
  }, input => guarded(async () => {
    const store = productionStore();
    const detail = store.assertActive(taskId, "visual");
    const projectId = detail.task.project_id;
    if (!projectId) throw new Error("연결된 프로젝트가 없습니다.");
    const document = contentJobRegistry.get(projectId).editor.document;
    const writes = new SlideshowProjectWrites(contentJobRegistry, store.db, project => {
      const active = store.assertActive(taskId, "visual");
      if (active.task.project_id !== project.id) throw new Error("연결된 프로젝트가 변경되었습니다.");
      validateProject?.(project);
    });
    const result = await writes.edit(projectId, badgeRepairCommands(document), input.expectedRevision, input.expectedTabId);
    return json({ projectId, revision: result.editor.revision, tabId: result.tabId, warnings: result.warnings });
  }));
  registerTool(
    server,
    "production_use_generated_image",
    {
      description: "Production only. Import an actual newly created native image_gen output from CODEX_HOME/generated_images into an existing image placement. localPath must be the real path returned by image_gen in THIS execution; older outputs and external files are rejected. Converts to lossless WebP and saves bytes in this project only. Duplicate image placements in this project are rejected atomically. Re-read revision after success. Never import past post/reference assets or reuse one generated asset in multiple placements.",
      inputSchema: z.object({
        slideId:z.string(),placementId:z.string(),expectedRevision:z.number().int(),expectedTabId:z.string(),localPath:z.string().min(1),
      }),
      annotations: annotations(false),
    },
    input => guarded(async () => {
      const store = productionStore();
      const detail = store.assertActive(taskId,"production");
      const projectId = detail.task.project_id;
      if (!projectId) throw new Error("먼저 프로젝트를 생성해 주세요.");
      const execution = imageExecution(taskId);
      const bytes = await readFreshGeneratedImage(input.localPath,execution.startedAt,join(generatedImagesRoot(),execution.threadId));
      // Recheck after file work: cancellation must not result in a late write.
      store.assertActive(taskId,"production");
      if (imageExecution(taskId).threadId !== execution.threadId) throw new OperationError("RUN_STAGE_CHANGED", "이미지 생성 실행이 변경되었습니다.");
      return json({...await importSlideshowImage(contentJobRegistry,store.db,{...input,projectId},bytes,project => {
        store.assertActive(taskId,"production");
        if (imageExecution(taskId).threadId !== execution.threadId) throw new OperationError("RUN_STAGE_CHANGED", "이미지 생성 실행이 변경되었습니다.");
        validateProject?.(project);
      })});
    }),
  );
  registerTool(
    server,
    "production_context",
    {
      description:
        "Read this task's current stage drafts, confirmed output, linked project and resumable work. Never recreate a linked project.",
      inputSchema: z.object({}),
      annotations: annotations(true),
    },
    () => guarded(() => json({ ...stageContext(productionStore().get(taskId)) })),
  );
  registerTool(
    server,
    "production_comparisons",
    {
      description:
        "Inspect other retained drafts and posts published within the last 24h. Compare candidates within the request constraints. If all considered candidates overlap, allow one duplicate and record the candidates and reason in the draft; never change a fixed source topic or format just to avoid overlap. Pending ideas do not reserve topics.",
      inputSchema: z.object({}),
      annotations: annotations(true),
    },
    () => guarded(() => json(productionStore().comparisons())),
  );
  registerTool(
    server,
    "production_save_draft",
    {
      description:
        "Persist current-stage progress only. Analysis: analysis/direction, structured reasoning (observations/interpretations/candidates), research/sources/actions. Production: slide_plan before image generation, content_review of actual content, content/direction_changes, research/sources/actions. Hook/visual/polish: review/content, research/sources/actions. Structured planning is retained separately from current content across saves/resume. Saving actual content sets draft_saved_at. Saves trigger UI pulse after DB commit.",
      inputSchema: z.object({
        patch: z.union([analysisPatchSchema, productionPatchSchema, reviewDraftPatchSchema]),
      }),
      annotations: annotations(false),
    },
    (input) =>
      guarded(() => {
        const store = productionStore(),
          step = store.get(taskId).task.current_step;
        return json({ ...store.save(taskId, step, input.patch) });
      }),
  );
  registerTool(
    server,
    "production_change_direction",
    {
      description:
        "During production only, resolve a recent collision within the request constraints. Preserve the format for past-post requests and the topic for external URLs. If all considered alternatives overlap, keep the direction and record why the duplicate is accepted instead of calling this tool repeatedly.",
      inputSchema: z.object({
        direction: directionSchema,
        cause: z.literal("collision"),
        reason: z.string().optional(),
      }),
      annotations: annotations(false),
    },
    (input) =>
      guarded(() => {
        productionStore().changeDirection(
          taskId,
          input.direction,
          input.cause,
          input.reason,
        );
        return json({ saved: true });
      }),
  );
  registerTool(server, "production_create_project", {
    description: "Production only. Create a blank 4:5 project for automatic or external-URL production. Compose a new layout using the assigned own posts collectively as references; copying a single post is not required. Reuses the task's linked project on resume. Past-post requests must use production_clone_project instead.",
    inputSchema: z.object({ slideCount: z.number().int().min(1).max(20).default(6) }),
    annotations: annotations(false),
  }, input => guarded(() => json(createTaskProject(productionStore(), taskId, input.slideCount))));
  registerTool(
    server,
    "production_clone_project",
    {
      description:
        "Production only, for past-post requests. Inspect and clone the explicitly selected saved source from production_context.input. It may be outside the assigned comparison pool. Preserve its format and visual language while changing the subject and content. Preserves frames, styles, shared elements, slide roles and badge; clears source text and all images, copies no source asset bytes. Change subject-specific wording and create fresh images while preserving the source format, page progression and visual composition. Records the source and reason. Reuses an existing linked project on resume without overwriting it.",
      inputSchema: z.object({
        sourceProjectId: z.string().min(1),
        reason: z.string().trim().min(1),
      }),
      annotations: annotations(false),
    },
    (input) =>
      guarded(() =>
        json(cloneTaskProject(productionStore(), taskId, input.sourceProjectId, input.reason)),
      ),
  );
}
