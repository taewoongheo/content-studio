import { z } from "zod";
import { layerSchema, videoDocumentSchema } from "@/domains/video/domain/model";

const id = z.string().uuid();
const frame = z.number().int().min(0).max(108000);
const [video, audio, image, text, shape] = layerSchema.options;
export const layerPatchSchema = z.strictObject({
  ...video.shape, ...audio.shape, ...image.shape, ...text.shape, ...shape.shape,
}).omit({ id: true, kind: true }).partial();
const addedLayer = z.union([
  video.omit({ id: true }).extend({ id: id.optional() }).strict(),
  audio.omit({ id: true }).extend({ id: id.optional() }).strict(),
  image.omit({ id: true }).extend({ id: id.optional() }).strict(),
  text.partial().required({ kind: true }).strict(),
  shape.partial().required({ kind: true }).strict(),
]);
export const settingsSchema = z.strictObject({
  width: videoDocumentSchema.shape.width.optional(), height: videoDocumentSchema.shape.height.optional(),
  fps: videoDocumentSchema.shape.fps.optional(), backgroundColor: videoDocumentSchema.shape.backgroundColor.optional(),
  duration: videoDocumentSchema.shape.duration.optional(),
});
export const videoCommandsSchema = z.array(z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("set_document"), changes: settingsSchema }),
  z.strictObject({ type: z.literal("add_layer"), layer: addedLayer }),
  z.strictObject({ type: z.literal("update_layer"), layerId: id, changes: layerPatchSchema }),
  z.strictObject({ type: z.literal("remove_layer"), layerId: id }),
  z.strictObject({ type: z.literal("duplicate_layer"), layerId: id, newLayerId: id.optional() }),
  z.strictObject({ type: z.literal("split_layer"), layerId: id, frame, secondLayerId: id.optional() }),
  z.strictObject({ type: z.literal("move_layer"), layerId: id, deltaFrames: z.number().int().min(-108000).max(108000) }),
  z.strictObject({ type: z.literal("trim_layer"), layerId: id, edge: z.enum(["start", "end"]), deltaFrames: z.number().int().min(-108000).max(108000) }),
  z.strictObject({ type: z.literal("reorder_layers"), layerIds: z.array(id).max(200) }),
  z.strictObject({ type: z.literal("reorder_sequence"), layerIds: z.array(id).max(200) }),
  z.strictObject({ type: z.literal("import_media"), localPath: z.string().min(1), layerId: id.optional(), mode: z.enum(["sequence", "overlay"]).default("sequence"), from: frame.optional() }),
  z.strictObject({ type: z.literal("replace_media"), layerId: id, localPath: z.string().min(1) }),
])).min(1).max(200);
export type VideoCommand = z.infer<typeof videoCommandsSchema>[number];
