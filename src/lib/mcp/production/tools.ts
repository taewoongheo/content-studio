import type { ProjectWriteValidator } from "@/domains/slideshow/server/project-writes";
import { join } from "node:path";
import { OperationError } from "@/lib/errors/operation";
import { readFreshGeneratedImage, generatedImagesRoot } from "@/domains/content-production/server/images/generated";
import { imageExecution } from "@/domains/content-production/server/execution/runner";
import { registerVisualReferenceTool } from "./visual-references";
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
import { createTaskProject } from "@/domains/content-production/server/projects";

export function registerProductionTools(server: McpServer, taskId?: string, origin = "http://127.0.0.1:3000", validateProject?: ProjectWriteValidator) {
  registerSourceTools(server, origin);
  registerTool(
    server,
    "production_query",
    {
      description:
        "During analysis, retrieve assigned own-post IDs with ids; selection and metrics come from the material node snapshot. Query keywords do not replace that set. In other stages, query published content logs: up to 10 best posts by (likes+comments+saves)/views, 10 lowest excluding the best, then 10 newest remaining, up to 30 unique. query filters eligible topic/name before selection. selection_group identifies performance/low_performance/recent. Missing metrics exclude rate rankings, not recency. Use production_external_references for the shared external library. Unpublished drafts are available through production_comparisons.",
      inputSchema: z.object({
        kind: z.literal("logs"),
        query: z.string().default(""),
        ids: z.array(z.string().min(1)).min(1).max(30).optional(),
      }),
      annotations: annotations(true),
    },
    (input) => guarded(() => {
      const store = productionStore();
      if (taskId && store.get(taskId).task.current_step === "analysis") {
        if (!input.ids) throw new Error("분석 단계에서는 전달받은 게시글 ID 목록으로 조회해 주세요.");
        return json({items:store.analysisLogs(taskId,input.ids)});
      }
      return json({items:store.planningLogs(input.query).filter(row => !input.ids || input.ids.includes(String(row.id)))});
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
  registerVisualReferenceTool(server, taskId);
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
    () => guarded(() => json({ ...productionStore().get(taskId) })),
  );
  registerTool(
    server,
    "production_comparisons",
    {
      description:
        "Inspect other retained drafts and posts published within the last 24h. First actual saved content keeps its topic/type; later overlapping content changes. Pending ideas do not reserve topics.",
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
        "Persist current-stage progress only. Analysis draft: analysis/direction plus research/sources/actions. Production draft: content/direction_changes plus research/sources/actions. Hook/visual/polish drafts: review/content plus research/sources/actions, each stored separately. Saving actual content sets draft_saved_at. Saves trigger UI pulse after DB commit.",
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
        "During production only, resolve a recent collision by replacing the conflicting direction, without abandoned-choice history. Research does not authorize a replacement topic; record a blocker if the confirmed premise fails.",
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
  registerTool(
    server,
    "production_create_project",
    {
      description:
        "Create a saved slideshow without a template and link it to this production task; reuses linked project on resume. Then open/read/edit using normal project tools.",
      inputSchema: z.object({
        slideCount: z.number().int().min(1).max(20).default(6),
      }),
      annotations: annotations(false),
    },
    (input) =>
      guarded(() =>
        json(createTaskProject(productionStore(), taskId, input.slideCount)),
      ),
  );
}
