import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CollectionRegistry } from "@/lib/research/collection/registry";
import * as z from "zod/v4";
import { json, guarded } from "../../../protocol/result";
import { researchAnnotations as annotations, jobSchema } from "../../shared";
import { solveCaptcha } from "@/lib/research/browser/captcha/captcha";

export function registerBrowserTools(server: McpServer, registry: CollectionRegistry) {
  server.registerTool("open_collection_browser", {
    description: "Bring the existing dedicated TikTok collection browser to the foreground and return its screenshot for computer use. Call only after collection stops. This is the same research session, not the user's browsing profile. Instagram search browsers are also supported; Python Instagram collection and InnerTube YouTube cannot be handed off. Do not create a fresh browser to solve a challenge for this session.",
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

}
