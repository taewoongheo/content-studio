import type { VideoSnapshot } from "@/domains/video/domain/model";
export function inspectVideo(snapshot: VideoSnapshot, options: { layerIds?: string[]; outline?: boolean; includeAssets?: boolean } = {}) {
  for (const id of options.layerIds ?? []) if (!snapshot.document.layers.some(layer => layer.id === id)) throw new Error(`요소를 찾을 수 없습니다: ${id}`);
  const layers = options.layerIds ? [...new Set(options.layerIds)].map(id => snapshot.document.layers.find(layer => layer.id === id)!) : snapshot.document.layers;
  if (options.outline) return {
    projectId: snapshot.id, tabId: snapshot.tabId, revision: snapshot.revision, name: snapshot.name,
    settings: { width: snapshot.document.width, height: snapshot.document.height, fps: snapshot.document.fps, duration: snapshot.document.duration, backgroundColor: snapshot.document.backgroundColor },
    layers: layers.map(layer => ({ id: layer.id, kind: layer.kind, name: layer.name, from: layer.from, duration: layer.duration,
      ...("text" in layer ? { text: layer.text } : {}), ...("assetId" in layer ? { assetId: layer.assetId } : {}) })),
    ...(options.includeAssets !== false ? { assets: snapshot.assets } : {}),
  };
  const { assets, ...withoutAssets } = snapshot;
  return { ...(options.includeAssets === false ? withoutAssets : { ...withoutAssets, assets }), ...(options.layerIds ? { partial: true } : {}),
    document: options.layerIds ? { ...snapshot.document, layers } : snapshot.document };
}
