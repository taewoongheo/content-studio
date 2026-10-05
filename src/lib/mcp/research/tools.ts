import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { json, guarded } from "../protocol/result";
import { researchRegistry } from "@/lib/research/collection/service";
import { criteriaSchema } from "@/lib/research/domain/schema";
import { socialSource } from "@/lib/research/domain/source";
import { readSourceImage } from "@/lib/research/media/images";
import { solveCaptcha } from "@/lib/research/browser/captcha";
import type { CollectionRegistry } from "@/lib/research/collection/registry";

const jobSchema = z.strictObject({ jobId: z.uuid() });
const annotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
export function registerResearchTools(server: McpServer, registry: CollectionRegistry = researchRegistry) {
  server.registerTool("list_account_posts", {
    description: "Start a bounded anonymous account-post collection. YouTube collects community posts. Declare your research purpose and follow AGENTS.md and docs/research-guidelines.md, with explicit user instructions taking precedence. For creation without a reference, begin research before selecting a template. Returns jobId/sessionId; use get_collection_job for results. Instagram/TikTok anonymous feeds may be blocked or unavailable. No comments are fetched. Reuse sessionId for cursor pagination. Never assume missing metrics satisfy criteria.",
    inputSchema: z.strictObject({ accountUrl: z.url(), limit: z.number().int().min(1).max(30).default(10),
      criteria: criteriaSchema.optional(), cursor: z.string().max(200).optional(), sessionId: z.uuid().optional() }), annotations,
  }, input => guarded(() => json(registry.start({ source: socialSource(input.accountUrl, "account"),
    kind: "account", limit: input.limit, criteria: input.criteria, cursor: input.cursor }, input.sessionId))));
  server.registerTool("read_social_post", {
    description: "Start anonymous collection of one public canonical post URL: text, ordered media URLs and available like/view/save/comment/share counts. Does not read comment text. YouTube requires the source channelUrl. Returns jobId/sessionId; get_collection_job returns the result. Missing metrics are null; criteriaEvaluation distinguishes failed/unverified/passed. Do not treat popularity as factual evidence.",
    inputSchema: z.strictObject({ url: z.url(), channelUrl: z.url().optional(), criteria: criteriaSchema.optional(), sessionId: z.uuid().optional() }), annotations,
  }, input => guarded(() => {
    const source = socialSource(input.url, "post");
    if (input.channelUrl && socialSource(input.channelUrl, "account").platform !== "youtube") throw new Error("channelUrl must be a YouTube channel URL.");
    return json(registry.start({ source, kind: "post", limit: 1, channelUrl: input.channelUrl, criteria: input.criteria }, input.sessionId));
  }));
  server.registerTool("get_collection_job", {
    description: "Read an in-memory collection job and results across MCP requests. A running job needs another check later. Block reasons distinguish visible captcha_required, login_required, rate_limited, access_denied, empty_response, unsupported and setup_required. HTTP 401/403 alone never means CAPTCHA. Results expire after 30 minutes of inactivity or session close/server restart.",
    inputSchema: jobSchema, annotations: { ...annotations, readOnlyHint: true },
  }, ({ jobId }) => guarded(() => json(registry.snapshot(jobId))));
  server.registerTool("read_post_images", {
    description: "Inspect selected source slideshow images from a completed collection, without creating/editing a project. Pass jobId and a postId from its result. imageIndexes are zero-based indexes into the post's ordered media array; select up to three images per call to bound output. Media URLs can expire; recollect when needed. No OCR or factual verification is implied.",
    inputSchema: z.strictObject({ jobId: z.uuid(), postId: z.string().max(200), imageIndexes: z.array(z.number().int().min(0).max(100)).min(1).max(3).default([0]) }),
    annotations: { ...annotations, readOnlyHint: true },
  }, input => guarded(async () => {
    const post = registry.getPost(input.jobId, input.postId);
    const indexes = [...new Set(input.imageIndexes)];
    const content = [];
    for (const index of indexes) {
      const media = post.media[index];
      if (!media || media.type !== "image") throw new Error(`Media index ${index} is not an image in this post.`);
      content.push({ type: "text" as const, text: JSON.stringify({ postId: post.id, imageIndex: index, sourceUrl: post.url }) });
      content.push(await readSourceImage(media.url));
    }
    return { content };
  }));
  server.registerTool("open_collection_browser", {
    description: "Bring the existing dedicated TikTok collection browser to the foreground and return its screenshot for computer use. Call only after collection stops. This is the same anonymous session, not the user's browsing profile. Python Instagram and InnerTube YouTube sessions cannot currently be handed off. Do not create a fresh browser to solve a challenge for this session.",
    inputSchema: jobSchema, annotations,
  }, ({ jobId }) => guarded(async () => {
    const { page, ...info } = await registry.openBrowser(jobId);
    return { ...json(info), content: [{ type: "image", mimeType: "image/png", data: (await page.screenshot()).toString("base64") }, ...json(info).content] };
  }));
  server.registerTool("solve_collection_captcha", {
    description: "Attempt a visible TikTok slider/rotate CAPTCHA with a configured local open-source solver, in the original stopped collection browser. CAPTCHA detection, image recognition, visual disappearance and successful source collection are separate. Returns solver_unavailable/unsupported_challenge/challenge_remaining/challenge_cleared; after handling call resume_collection. Optional selectors allow adapting known challenge layouts; this is not a universal solver.",
    inputSchema: z.strictObject({ jobId: z.uuid(), type: z.enum(["slider", "rotate"]).default("slider"),
      backgroundSelector: z.string().max(500).default(".captcha_verify_img--wrapper img:first-of-type"),
      pieceSelector: z.string().max(500).default(".captcha_verify_img--wrapper img:last-of-type"),
      sliderSelector: z.string().max(500).default(".captcha_verify_slide--slidebar"),
      trackSelector: z.string().max(500).default(".captcha_verify_slide") }), annotations,
  }, input => guarded(async () => {
    const snapshot = registry.snapshot(input.jobId);
    if (snapshot.status !== "blocked" || snapshot.block?.reason !== "captcha_required") throw new Error("This job is not blocked by a confirmed CAPTCHA.");
    const { page } = await registry.openBrowser(input.jobId);
    return json(await solveCaptcha(page, input));
  }));
  server.registerTool("resume_collection", {
    description: "Retry a blocked collection in the retained session after addressing its actual block reason. Max three attempts per job. A successful data response confirms recovery; solving a visual challenge alone does not. No automatic retry loop or required research workflow is imposed.",
    inputSchema: jobSchema, annotations,
  }, ({ jobId }) => guarded(() => json(registry.resume(jobId))));
  server.registerTool("close_collection_session", {
    description: "Cancel jobs, close only this research session's dedicated browser and discard its temporary in-memory results/cursors. Idempotent. Does not close Content Studio projects or the user's browser. Use after finishing research.",
    inputSchema: z.strictObject({ sessionId: z.uuid() }), annotations,
  }, ({ sessionId }) => guarded(async () => json(await registry.close(sessionId))));
}
