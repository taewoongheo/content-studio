import { importSlideshowImage } from "@/domains/slideshow/server/import-image";
import { ContentProjectStore } from "@/domains/slideshow/server/persistence/projects/store";
import { contentJobRegistry } from "@/domains/slideshow/workflow/service";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { registerTool } from "../protocol/tools";
import { annotations, guarded, json } from "../protocol/result";
import { productionStore } from "@/domains/content-production/server/execution/runner";
import { references } from "@/domains/content-production/server/persistence/library";
import {
  analysisPatchSchema,
  productionPatchSchema,
  directionSchema,
} from "@/domains/content-production/domain/contracts";
import { createTaskProject } from "@/domains/content-production/server/projects";

export function registerProductionTools(server: McpServer, taskId?: string) {
  registerTool(
    server,
    "production_query",
    {
      description:
        "Query published content logs (post_url registered) or user-selected references. Unpublished drafts are available through production_comparisons for duplication checks. Data is available in either stage; no minimum count. Read actual images as needed, and distinguish planned direction from actual content and observed performance.",
      inputSchema: z.object({
        kind: z.enum(["logs", "references"]),
        query: z.string().default(""),
      }),
      annotations: annotations(true),
    },
    (input) =>
      guarded(() =>
        json({
          items:
            input.kind === "logs"
              ? productionStore().logs(input.query, true)
              : references(productionStore().db, input.query),
        }),
      ),
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
  registerTool(
    server,
    "production_import_image",
    {
      description:
        "Copy an image from an existing saved project asset or stored reference slide into this task's image placement. No shell downloads or persistent temporary files. Re-read latest revision after success.",
      inputSchema: z.object({
        slideId: z.string(),
        placementId: z.string(),
        expectedRevision: z.number().int(),
        expectedTabId: z.string(),
        source: z.union([
          z.object({ projectId: z.string(), assetId: z.string() }),
          z.object({
            setId: z.string(),
            index: z.number().int().nonnegative(),
          }),
        ]),
      }),
      annotations: annotations(false),
    },
    (input) =>
      guarded(async () => {
        const store = productionStore(),
          detail = store.assertActive(taskId, "production"),
          projectId = String(detail.task.project_id ?? "");
        if (!projectId) throw new Error("먼저 프로젝트를 생성해 주세요.");
        const data =
          "projectId" in input.source
            ? new ContentProjectStore(store.db).getAsset(
                input.source.projectId,
                input.source.assetId,
              )?.bytes
            : (
                store.db
                  .prepare(
                    "SELECT data FROM content_visual_slides WHERE set_id=? AND slide_index=?",
                  )
                  .get(input.source.setId, input.source.index) as
                  { data: Buffer } | undefined
              )?.data;
        if (!data) throw new Error("원본 이미지를 찾을 수 없습니다.");
        const job = await importSlideshowImage(
          contentJobRegistry,
          store.db,
          { ...input, projectId },
          data,
        );
        return json({ ...job });
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
        "Persist current-stage progress only. Analysis draft: analysis/direction plus research/sources/actions. Production draft: content/direction_changes plus additional research/sources/actions. Saving actual content sets draft_saved_at. Saves trigger UI pulse after DB commit.",
      inputSchema: z.object({
        patch: z.union([analysisPatchSchema, productionPatchSchema]),
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
        "During production, collision overwrites analysis/log direction and clears abandoned content, no old-choice history. Research changes preserve initial output and record reason plus new direction.",
      inputSchema: z.object({
        direction: directionSchema,
        cause: z.enum(["collision", "research"]),
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
