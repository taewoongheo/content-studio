import { createHash } from "node:crypto";
import type { ContentJobRecord } from "@/domains/slideshow/domain/types";
import { OperationError } from "@/lib/errors/operation";

/** Compare bytes as well as IDs: renamed/copied assets must not evade the project rule. */
export function assertUniqueProjectImages(project: ContentJobRecord) {
  const kinds = new Map(project.editor.document.elements.map(element => [element.id, element.kind]));
  const hashes = new Map<string, string>();
  const used = new Map<string, { slide_id: string; placement_id: string; asset_id: string }>();
  for (const slide of project.editor.document.slides) for (const placement of slide.placements) {
    if (kinds.get(placement.elementId) !== "image" || !placement.value) continue;
    const assetId = placement.value;
    let hash = hashes.get(assetId);
    if (!hash) {
      const bytes = project.imageData[assetId];
      if (!bytes) throw new OperationError("IMAGE_ASSET_MISSING", "이미지 데이터를 찾을 수 없습니다.", {asset_id:assetId});
      hash = createHash("sha256").update(bytes).digest("hex");
      hashes.set(assetId, hash);
    }
    const current = {slide_id:slide.id,placement_id:placement.id,asset_id:assetId};
    const previous = used.get(hash);
    if (previous) throw new OperationError("DUPLICATE_PROJECT_IMAGE", "한 콘텐츠에서 같은 이미지를 두 번 사용할 수 없습니다. 별도 이미지를 생성해 주세요.", {first:previous,duplicate:current});
    used.set(hash,current);
  }
}
