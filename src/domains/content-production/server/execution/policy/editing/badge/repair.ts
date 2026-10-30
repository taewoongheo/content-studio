import type { EditorCommand, EditorDocument } from "@/domains/slideshow/editor/types";

export function badgeElementIds(document: EditorDocument) {
  return new Set(document.elements.filter(element => element.kind !== "background" &&
    /badge|brand|logo|뱃지|배지|브랜드|로고/i.test(`${element.id} ${element.name} ${element.role}`)).map(element => element.id));
}

/** Restore the selected source's badge, never a globally prescribed brand. */
export function badgeRepairCommands(document: EditorDocument, source: EditorDocument): EditorCommand[] {
  const ids = badgeElementIds(source);
  if (!ids.size) return [];
  const placements = (values: EditorDocument["slides"][number]["placements"]) => JSON.stringify(values.filter(p => ids.has(p.elementId)).map(p => ({...p,textColors:p.textColors ?? [],textWeights:p.textWeights ?? []})));
  const matches = [...ids].every(id => JSON.stringify(document.elements.find(element => element.id === id)) === JSON.stringify(source.elements.find(element => element.id === id))) &&
    document.slides.every(slide => {
      const original = source.slides.find(original => original.id === slide.id);
      if (!original) return true;
      const sharedImages = new Set(slide.placements.filter(p =>
        document.elements.find(e => e.id === p.elementId)?.kind === "image" &&
        original.placements.some(other => other.id === p.id && source.elements.find(e => e.id === other.elementId)?.kind === "image")
      ).map(p => p.id));
      return placements(slide.placements) === placements(original.placements) &&
        slide.placements.filter(p => ids.has(p.elementId) || sharedImages.has(p.id)).map(p => p.id).join() ===
        original.placements.filter(p => ids.has(p.elementId) || sharedImages.has(p.id)).map(p => p.id).join();
    });
  if (matches) return [];
  const commands: EditorCommand[] = [];
  const sourceSlides = new Set(source.slides.map(slide => slide.id));

  for (const slide of document.slides) for (const placement of slide.placements)
    if (ids.has(placement.elementId)) commands.push({type:"remove_placement",slideId:slide.id,placementId:placement.id});
  for (const id of ids) {
    if (document.elements.some(element => element.id === id)) commands.push({type:"remove_element",elementId:id});
    commands.push({type:"add_element",element:structuredClone(source.elements.find(element => element.id === id)!)});
  }
  for (const slide of document.slides) {
    const original = source.slides.find(original => original.id === slide.id) ?? slide;
    if (!sourceSlides.has(slide.id) && !slide.placements.some(p => ids.has(p.elementId))) continue;
    for (const placement of original.placements.filter(placement => ids.has(placement.elementId))) {
      commands.push({type:"place_element",slideId:slide.id,elementId:placement.elementId,placementId:placement.id},
        {type:"set_slot_value",slideId:slide.id,placementId:placement.id,value:placement.value,
          textColors:placement.textColors,textWeights:placement.textWeights});
      if (placement.frameOverride || placement.styleOverride) commands.push({type:"update_visual",scope:"local",slideId:slide.id,placementId:placement.id,
        ...(placement.frameOverride ? {frame:placement.frameOverride} : {}),...(placement.styleOverride ? {style:placement.styleOverride} : {})});
    }
    const currentIds = new Set(slide.placements.filter(placement => !ids.has(placement.elementId)).map(placement => placement.id));
    const order = original.placements.filter(placement => ids.has(placement.elementId) || currentIds.has(placement.id)).map(placement => placement.id);
    const background = slide.placements.find(placement => document.elements.find(element => element.id === placement.elementId)?.kind === "background")?.id;
    const all = [...order,...[...currentIds].filter(id => !order.includes(id))];
    commands.push({type:"reorder_layers",slideId:slide.id,placementIds:[...all.filter(id => id !== background),...(background ? [background] : [])]});
  }
  return commands;
}
