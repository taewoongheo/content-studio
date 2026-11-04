import type { assistantSnapshot } from "./service";

/** Text and IDs are enough to start; exact geometry/assets remain available through read tools. */
export function assistantContext(snapshot: ReturnType<typeof assistantSnapshot>) {
  if (!("editor" in snapshot)) {
    return { projectId: snapshot.id, tabId: snapshot.tabId, revision: snapshot.revision,
      document: snapshot.document };
  }
  const document = snapshot.editor.document;
  return { projectId: snapshot.id, tabId: snapshot.tabId, revision: snapshot.editor.revision,
    name: snapshot.name, aspectRatio: document.aspectRatio,
    slides: document.slides.map(slide => ({ id: slide.id, role: slide.role,
      elements: slide.placements.map(placement => {
        const element = document.elements.find(item => item.id === placement.elementId);
        return { placementId: placement.id, elementId: placement.elementId, kind: element?.kind,
          name: element?.name, value: placement.value };
      }).filter(element => element.kind !== "background"),
    })),
  };
}
