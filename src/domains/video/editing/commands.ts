import { createLayer, layerSchema, reflowSequence, splitVideoLayer, type VideoDocument, type VideoLayer } from "@/domains/video/domain/model";
import { adjustLayerTiming, updateVideoLayer } from "@/domains/video/domain/editing";
import { changeVideoFps } from "@/domains/video/domain/settings";
import type { VideoCommand } from "@/domains/video/editing/schema";

export function requireLayer(doc: VideoDocument, id: string) {
  const layer = doc.layers.find(layer => layer.id === id);
  if (!layer) throw new Error(`요소를 찾을 수 없습니다: ${id}`);
  return layer;
}
function exactOrder(actual: string[], requested: string[]) {
  if (actual.length !== requested.length || new Set(requested).size !== requested.length || requested.some(id => !actual.includes(id)))
    throw new Error("현재 요소 ID를 중복·누락 없이 모두 지정해 주세요.");
}
export function parseLayer(value: unknown): VideoLayer {
  const kind = (value as { kind?: string })?.kind;
  const schema = layerSchema.options.find(option => option.shape.kind.value === kind);
  if (!schema) throw new Error("지원하지 않는 요소 종류입니다.");
  return schema.strict().parse(value);
}
export function applyVideoCommand(doc: VideoDocument, command: Exclude<VideoCommand, { type: "import_media" | "replace_media" }>): VideoDocument {
  switch (command.type) {
    case "set_document": {
      const changed = command.changes.fps ? changeVideoFps(doc, command.changes.fps) : doc;
      return reflowSequence({ ...changed, ...command.changes });
    }
    case "add_layer": {
      const input = command.layer;
      const defaults = input.kind === "text" || input.kind === "shape" ? createLayer(input.kind, doc, input.from ?? 0) : {};
      const layer = parseLayer({ ...defaults, ...input, id: input.id ?? crypto.randomUUID() });
      if (doc.layers.some(item => item.id === layer.id)) throw new Error("중복 요소 ID입니다.");
      return reflowSequence({ ...doc, layers: [...doc.layers, layer] });
    }
    case "update_layer": {
      const before = requireLayer(doc, command.layerId);
      const layer = parseLayer({ ...before, ...command.changes });
      return reflowSequence(updateVideoLayer(doc, layer));
    }
    case "remove_layer":
      requireLayer(doc, command.layerId);
      return reflowSequence({ ...doc, layers: doc.layers.filter(layer => layer.id !== command.layerId) });
    case "duplicate_layer": {
      const layer = requireLayer(doc, command.layerId);
      return applyVideoCommand(doc, { type: "add_layer", layer: { ...layer, id: command.newLayerId ?? crypto.randomUUID(), name: `${layer.name.slice(0, 115)} 복사본` } });
    }
    case "split_layer": {
      const pair = splitVideoLayer(requireLayer(doc, command.layerId), command.frame);
      if (!pair) throw new Error("반복하지 않는 영상의 재생 구간 안에서 분할해 주세요.");
      if (command.secondLayerId) pair[1].id = command.secondLayerId;
      return reflowSequence({ ...doc, layers: doc.layers.flatMap(layer => layer.id === command.layerId ? pair : [layer]) });
    }
    case "move_layer":
    case "trim_layer": {
      const layer = adjustLayerTiming(requireLayer(doc, command.layerId), command.deltaFrames, command.type === "move_layer" ? "move" : command.edge);
      return reflowSequence(updateVideoLayer(doc, layer));
    }
    case "reorder_layers": {
      exactOrder(doc.layers.map(layer => layer.id), command.layerIds);
      return { ...doc, layers: command.layerIds.map(id => requireLayer(doc, id)) };
    }
    case "reorder_sequence": {
      exactOrder(doc.layers.filter(layer => layer.kind === "video" && layer.sequence).map(layer => layer.id), command.layerIds);
      const order = new Map(command.layerIds.map((id, index) => [id, index]));
      return reflowSequence({ ...doc, layers: doc.layers.map(layer => order.has(layer.id) ? { ...layer, sequenceIndex: order.get(layer.id)! } : layer) });
    }
  }
}
