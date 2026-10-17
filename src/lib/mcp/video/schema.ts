import { z } from "zod";
import { videoCommandsSchema } from "@/domains/video/editing/schema";
const id = z.string().uuid();
const frame = z.number().int().min(0).max(108000);
export const videoProjectSchema = z.strictObject({ projectId: id });
export const videoRevisionSchema = videoProjectSchema.extend({ expectedTabId: id, expectedRevision: z.number().int().nonnegative() });
export const videoEditSchema = videoRevisionSchema.extend({ commands: videoCommandsSchema, includeDocument: z.boolean().default(false) });
export const videoPreviewSchema = videoProjectSchema.extend({ frames: z.array(frame).min(1).max(8), width: z.number().int().min(64).max(1920).default(540) });
