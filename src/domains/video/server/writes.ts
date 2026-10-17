import { appendFrame, reflowSequence, type VideoSnapshot } from "@/domains/video/domain/model";
import { createMediaLayer } from "@/domains/video/domain/media/layer";
import { checkVideoRevision, commitVideoEdit, readVideo } from "@/domains/video/server/service";
import { applyVideoCommand, parseLayer, requireLayer } from "@/domains/video/editing/commands";
import { readLocalVideoMedia, type LocalVideoMedia } from "@/domains/video/server/media/local";
import { videoCommandsSchema, type VideoCommand } from "@/domains/video/editing/schema";

export async function editVideoProject(projectId: string, tabId: string, revision: number, input: VideoCommand[],
  readMedia = readLocalVideoMedia): Promise<VideoSnapshot> {
  const commands = videoCommandsSchema.parse(input);
  checkVideoRevision(projectId, tabId, revision);
  const prepared = new Map<string, LocalVideoMedia>();
  for (const command of commands) {
    if ((command.type === "import_media" || command.type === "replace_media") && !prepared.has(command.localPath))
      prepared.set(command.localPath, await readMedia(command.localPath));
  }
  // Metadata reads are asynchronous: recheck inside the commit before registering any bytes.
  const original = readVideo(projectId);
  return commitVideoEdit(projectId, tabId, revision, (document, store) => {
    const assets = new Map<string, string>();
    for (const [index, command] of commands.entries()) {
      try {
        if (command.type !== "import_media" && command.type !== "replace_media") {
          document = applyVideoCommand(document, command);
          continue;
        }
        const media = prepared.get(command.localPath)!;
        const previous = command.type === "replace_media" ? requireLayer(document, command.layerId) : undefined;
        if (previous && previous.kind !== media.kind) throw new Error("같은 종류의 미디어로 교체해 주세요.");
        if (!store.get(projectId)) store.save(projectId, original.name, original.document, original.revision);
        let assetId = assets.get(command.localPath);
        if (!assetId) {
          assetId = store.addAsset(projectId, media.name, media.type, media.bytes).id;
          assets.set(command.localPath, assetId);
        }
        if (previous) {
          const sourceFrames = Math.max(1, Math.round(media.info.duration * document.fps));
          const layer = parseLayer({ ...previous, assetId,
            ...(previous.kind === "video" || previous.kind === "audio" ? {
              sourceFrames, trimStart: 0, trimEnd: sourceFrames,
              duration: previous.loop ? previous.duration : Math.min(previous.duration, sourceFrames),
            } : {}),
          });
          document = reflowSequence({ ...document, layers: document.layers.map(item => item.id === layer.id ? layer : item) });
        } else if (command.type === "import_media") {
          const sequence = media.kind === "video" && command.mode === "sequence";
          const from = command.from ?? (sequence ? appendFrame(document) : 0);
          const layer = createMediaLayer({ kind: media.kind, name: media.name, assetId, info: media.info,
            document, from, overlay: !sequence, id: command.layerId });
          if (document.layers.some(item => item.id === layer.id)) throw new Error("중복 요소 ID입니다.");
          document = reflowSequence({ ...document, duration: sequence && !document.layers.length ? 1 : document.duration, layers: [...document.layers, layer] });
        }
      } catch (cause) {
        throw new Error(`commands[${index}]: ${cause instanceof Error ? cause.message : "편집 실패"}`);
      }
    }
    return document;
  });
}
