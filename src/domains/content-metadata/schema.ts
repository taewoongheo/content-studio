import * as z from "zod/v4";

/** Shared authored metadata for own posts and external references. Empty legacy values remain readable. */
export const contentMetadataSchema = z.strictObject({
  topic: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  content_type: z.string().trim().min(1).max(1000),
});
export type ContentMetadata = z.infer<typeof contentMetadataSchema>;
