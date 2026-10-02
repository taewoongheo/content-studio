import { useId, useRef, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil } from "lucide-react";
import type { EditorCommand, EditorDocument, EditorSlide } from "@/lib/content-jobs/editor/types";
import { reorderedSlideIds, roleLabels, slideLabel } from "./slide-navigation";

type Props = {
  document: EditorDocument;
  selectedSlideId: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  onCommand: (commands: EditorCommand[]) => Promise<boolean>;
};

function SlideTab({ slide, index, selected, movable, disabled, onSelect, onCommand }: {
  slide: EditorSlide; index: number; selected: boolean; movable: boolean;
  disabled: boolean; onSelect: Props["onSelect"]; onCommand: Props["onCommand"];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const committing = useRef(false);
  const cancelled = useRef(false);
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } =
    useSortable({ id: slide.id, disabled: disabled || saving || editing || !movable });
  async function commitName() {
    if (committing.current || cancelled.current) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === (slide.name || roleLabels[slide.role])) { setEditing(false); return; }
    committing.current = true;
    setSaving(true);
    try {
      if (await onCommand([{ type: "rename_slide", slideId: slide.id, name: trimmed }])) setEditing(false);
    } finally { committing.current = false; setSaving(false); }
  }
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex shrink-0 touch-none cursor-grab items-center rounded-lg border text-xs font-medium active:cursor-grabbing ${selected ? "border-foreground bg-muted text-foreground" : "border-border bg-background text-muted-foreground"} ${isDragging ? "relative z-10 opacity-70" : ""}`}>
      {editing ? <input autoFocus aria-label="슬라이드 이름" maxLength={120} value={name} disabled={saving || disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => setName(event.target.value)} onBlur={() => void commitName()}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") { event.preventDefault(); void commitName(); }
          if (event.key === "Escape") { cancelled.current = true; setEditing(false); }
        }} className="m-1 w-36 min-w-0 rounded border border-border bg-background px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-foreground" />
        : <button type="button" {...attributes} {...listeners} disabled={disabled} onClick={() => onSelect(slide.id)}
          aria-label={`${slideLabel(slide, index)} 선택 및 순서 이동`}
          aria-current={selected ? "page" : undefined} className="max-w-52 cursor-grab truncate px-3 py-3 hover:bg-muted focus-visible:outline-2 active:cursor-grabbing">
          {slideLabel(slide, index)}
        </button>}
      <button type="button" disabled={disabled || editing || saving} aria-label={`${slideLabel(slide, index)} 이름 변경`}
        onPointerDown={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}
        title="이름 변경" onClick={() => { cancelled.current = false; setName(slide.name || roleLabels[slide.role]); setEditing(true); }}
        className="px-2 py-3 hover:text-foreground disabled:opacity-40"><Pencil size={12} /></button>
    </div>
  );
}

export function SlideTabs({ document, selectedSlideId, disabled, onSelect, onCommand }: Props) {
  const id = useId();
  const [reordering, setReordering] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  return <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragEnd={async ({ active, over }) => {
    if (!over || disabled || reordering) return;
    const slideIds = reorderedSlideIds(document, String(active.id), String(over.id));
    if (!slideIds) return;
    setReordering(true);
    try { await onCommand([{ type: "reorder_slides", slideIds }]); } finally { setReordering(false); }
  }}>
    <SortableContext items={document.slides.map((slide) => slide.id)} strategy={horizontalListSortingStrategy}>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {document.slides.map((slide, index) => <SlideTab key={slide.id} slide={slide} index={index}
          selected={slide.id === selectedSlideId} movable
          disabled={disabled || reordering} onSelect={onSelect} onCommand={onCommand} />)}
      </div>
    </SortableContext>
  </DndContext>;
}
