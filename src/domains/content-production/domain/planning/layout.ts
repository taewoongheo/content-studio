import { z } from "zod";

export const layoutChecksSchema = z.array(z.object({
  slide_id:z.string().min(1), from_id:z.string().min(1), to_id:z.string().min(1),
  axis:z.enum(["x","y"]), min_gap:z.number().min(0).max(1350), max_gap:z.number().min(0).max(1350),
  reason:z.string().trim().min(1),
})).max(200);
export type LayoutCheck = z.infer<typeof layoutChecksSchema>[number];
