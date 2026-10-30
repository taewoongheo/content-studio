import type { Row, ProductionStep } from "../../../domain/contracts";
import type { ContentJobRecord } from "@/domains/slideshow/domain/types";
import { badgeElementIds } from "../policy/editing/badge/repair";

/** Review output reports edits; saved text and approved metadata remain authoritative. */
export function reviewedSummary(_step: ProductionStep, previous: Row, reported: Row, project: ContentJobRecord): Row {
  const document = project.editor.document;
  const badges = badgeElementIds(document);
  const textElements = new Set(document.elements.filter(element => element.kind === "text").map(element => element.id));
  const priorSlides = Array.isArray(reported.slides) ? reported.slides as Row[] : Array.isArray(previous.slides) ? previous.slides as Row[] : [];
  const visuals = new Map(priorSlides.map(slide => [slide.slide_id, slide.visual]));
  const slides = document.slides.map(slide => ({
    slide_id:slide.id,role:slide.role,
    copy:slide.placements.filter(placement => !badges.has(placement.elementId) && textElements.has(placement.elementId)).map(placement => placement.value),
    visual:visuals.get(slide.id) ?? "",
  }));
  return {...previous, ...reported,
    hook:slides.filter(slide => slide.role === "hook").flatMap(slide => slide.copy).join("\n"),
    slides,changes:reported.changes ?? [],
  };
}
