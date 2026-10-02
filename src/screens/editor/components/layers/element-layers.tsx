import { useId, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BACKGROUND_PLACEMENT_ID } from "@/lib/content-jobs/editor/background";
import type { EditorCommand, EditorDocument, EditorSlide, PlacedElement } from "@/lib/content-jobs/editor/types";
import { frontToBack, reorderLayerCommands } from "./layer-order";

type Props = {
  document: EditorDocument; slide: EditorSlide; selectedPlacementId: string | null;
  selectedSlideIds: string[]; disabled: boolean;
  onSelect: (id: string) => void;
  onCommand: (commands: EditorCommand[]) => Promise<boolean>;
};

function LayerRow({ placement, name, role, selected, disabled, onSelect }: {
  placement: PlacedElement; name: string; role: string; selected: boolean;
  disabled: boolean; onSelect: Props["onSelect"];
}) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } =
    useSortable({ id: placement.id, disabled });
  return <button ref={setNodeRef} type="button" {...attributes} {...(disabled ? {} : listeners)} aria-disabled={undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      aria-label={`${name} Element 선택 및 레이어 순서 이동`} aria-pressed={selected} onClick={() => onSelect(placement.id)}
      className={`min-w-0 shrink-0 touch-none rounded-md border px-3 py-3 text-left text-xs focus-visible:outline-2 ${disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${selected ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"} ${isDragging ? "relative z-10 bg-muted opacity-70" : ""}`}>
      <span className="block truncate font-medium">{name}</span>
      <span className="mt-0.5 block truncate text-muted-foreground">{role}</span>
    </button>;
}

export function ElementLayers({ document, slide, selectedPlacementId, selectedSlideIds, disabled, onSelect, onCommand }: Props) {
  const id = useId();
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const order = frontToBack(slide);
  return <DndContext id={id} sensors={sensors} collisionDetection={closestCenter}
    onDragStart={({ active }) => onSelect(String(active.id))}
    onDragEnd={async ({ active, over }) => {
      if (!over || disabled || saving) return;
      const commands = reorderLayerCommands(document, slide.id, String(active.id), String(over.id), selectedSlideIds);
      if (!commands.length) return;
      setSaving(true);
      try { await onCommand(commands); } finally { setSaving(false); }
    }}>
    <SortableContext items={order.map((item) => item.id)} strategy={verticalListSortingStrategy}>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain py-2">
        {order.map((item) => {
          const definition = document.elements.find((element) => element.id === item.elementId);
          return <LayerRow key={item.id} placement={item} name={definition?.name ?? "Element"} role={definition?.role ?? ""}
            selected={item.id === selectedPlacementId} disabled={disabled || saving} onSelect={onSelect} />;
        })}
        <button type="button" onClick={() => onSelect(BACKGROUND_PLACEMENT_ID)}
          aria-pressed={selectedPlacementId === BACKGROUND_PLACEMENT_ID}
          className={`mt-1 shrink-0 rounded-md border px-3 py-3 text-left text-xs font-medium hover:bg-muted focus-visible:outline-2 ${selectedPlacementId === BACKGROUND_PLACEMENT_ID ? "border-foreground bg-muted" : "border-border"}`}>배경</button>
      </div>
    </SortableContext>
  </DndContext>;
}
