import * as z from "zod/v4";
export const jobSchema = z.strictObject({ jobId: z.uuid() });
export const researchAnnotations = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
