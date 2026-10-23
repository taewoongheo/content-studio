import * as z from "zod/v4";

export const contentMetadataSchema = z.strictObject({
  topic: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
});
export type ContentMetadata = z.infer<typeof contentMetadataSchema>;
