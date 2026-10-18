import type { EditorDocument, ElementDefinition, ElementFrame, ElementStyle } from "../types";
import { withStyleDefaults } from "../elements/style";
import { artworkSize } from "../../rendering/layout";

export const SHARED_ELEMENT_TOLERANCES = { position: 7, imageSize: 20, fontSize: 4, shapeSize: 10 } as const;
type Candidate = { slideId: string; placementId: string; elementId: string; kind: ElementDefinition["kind"]; frame: ElementFrame; style: ElementStyle };
export type SharedElementWarning = {
  code: "POSSIBLE_UNSHARED_ELEMENT";
  message: string;
  matches: Array<{ first: Pick<Candidate, "slideId" | "placementId" | "elementId">; second: Pick<Candidate, "slideId" | "placementId" | "elementId"> }>;
};
const sameColor = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const near = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance + 1e-7;

/** Advisory only. Inspect resolved placements, without interpreting names, roles or content. */
export function inspectSharedElements(document: EditorDocument): SharedElementWarning[] {
  const size = artworkSize(document.aspectRatio);
  const elements = new Map(document.elements.map(element => [element.id, element]));
  const candidates: Candidate[] = document.slides.filter(slide => slide.role === "body").flatMap(slide =>
    slide.placements.flatMap(placement => {
      const element = elements.get(placement.elementId);
      if (!element || element.kind === "background") return [];
      return [{ slideId: slide.id, placementId: placement.id, elementId: element.id, kind: element.kind,
        frame: placement.frameOverride ?? element.frame, style: withStyleDefaults({ ...element.style, ...placement.styleOverride }) }];
    }));
  const matches: SharedElementWarning["matches"] = [];
  const ref = ({ slideId, placementId, elementId }: Candidate) => ({ slideId, placementId, elementId });
  for (let i = 0; i < candidates.length; i++) for (let j = i + 1; j < candidates.length; j++) {
    const a = candidates[i], b = candidates[j], tolerance = SHARED_ELEMENT_TOLERANCES;
    if (a.slideId === b.slideId || a.elementId === b.elementId || a.kind !== b.kind) continue;
    if (!near(a.frame.x * size.width, b.frame.x * size.width, tolerance.position) ||
      !near(a.frame.y * size.height, b.frame.y * size.height, tolerance.position)) continue;
    if (a.kind === "text") {
      if (a.style.fontFamily !== b.style.fontFamily || !near(a.style.fontSize, b.style.fontSize, tolerance.fontSize) ||
        !sameColor(a.style.color, b.style.color) || !sameColor(a.style.backgroundColor, b.style.backgroundColor)) continue;
    } else {
      const limit = a.kind === "image" ? tolerance.imageSize : tolerance.shapeSize;
      if (!near(a.frame.width * size.width, b.frame.width * size.width, limit) ||
        !near(a.frame.height * size.height, b.frame.height * size.height, limit)) continue;
      if (a.kind !== "image" && (!sameColor(a.style.backgroundColor, b.style.backgroundColor) ||
        a.style.borderEnabled !== b.style.borderEnabled ||
        (a.style.borderEnabled && !sameColor(a.style.borderColor!, b.style.borderColor!)))) continue;
    }
    matches.push({ first: ref(a), second: ref(b) });
  }
  // Group connected candidates for presentation, retaining exact pairs rather than claiming transitive similarity.
  const groups: typeof matches[] = [];
  const key = (r: ReturnType<typeof ref>) => JSON.stringify([r.slideId, r.placementId]);
  for (const match of matches) {
    const touching = groups.filter(group => group.some(pair => [pair.first, pair.second].some(r => key(r) === key(match.first) || key(r) === key(match.second))));
    const group = [match, ...touching.flat()];
    for (const old of touching) groups.splice(groups.indexOf(old), 1);
    groups.push(group);
  }
  return groups.map(group => ({ code: "POSSIBLE_UNSHARED_ELEMENT", message: "본문의 유사한 요소가 서로 다른 Element를 사용합니다. 함께 수정할 요소인지 확인하고 필요하면 rebind_element로 연결하세요.", matches: group }));
}
