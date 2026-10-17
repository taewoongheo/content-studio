import { useId } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { VideoLayer } from "@/lib/video/domain/model";
const roles = { text: "텍스트", image: "이미지", video: "영상", audio: "오디오", shape: "도형" };
function LayerRow({ layer, selected, disabled, onSelect }: { layer: VideoLayer; selected: boolean; disabled: boolean; onSelect: (id: string) => void }) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id: layer.id, disabled });
  return <button ref={setNodeRef} type="button" data-video-layer={layer.id} {...attributes} {...(disabled ? {} : listeners)} disabled={disabled}
    aria-label={`${layer.name} Element 선택 및 레이어 순서 이동`} aria-pressed={selected} onClick={() => onSelect(layer.id)}
    style={{ transform: CSS.Transform.toString(transform), transition }}
    className={`min-w-0 shrink-0 touch-none rounded-md border px-3 py-3 text-left text-xs focus-visible:outline-2 ${disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${selected ? "border-foreground bg-muted" : "border-border hover:bg-muted/50"} ${isDragging ? "relative z-10 bg-muted opacity-70" : ""}`}>
    <span className="block truncate font-medium">{layer.name}</span>
    <span className="mt-0.5 block truncate text-muted-foreground">{roles[layer.kind]}{layer.kind === "video" && layer.sequence ? " · 이어붙이기" : ""}</span>
  </button>;
}
export function VideoLayers({ layers, selected, disabled, onSelect, onReorder }: { layers: VideoLayer[]; selected: string | null; disabled: boolean; onSelect: (id: string | null) => void; onReorder: (active: string, over: string) => void }) {
  const id = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const order = [...layers].reverse();
  return <DndContext id={id} sensors={sensors} collisionDetection={closestCenter} onDragStart={({ active }) => onSelect(String(active.id))}
    onDragEnd={({ active, over }) => { if (!disabled && over && active.id !== over.id) onReorder(String(active.id), String(over.id)); }}>
    <SortableContext items={order.map(l => l.id)} strategy={verticalListSortingStrategy}>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain py-2">
        {order.map(layer => <LayerRow key={layer.id} layer={layer} selected={selected === layer.id} disabled={disabled} onSelect={onSelect} />)}
        <button type="button" disabled={disabled} aria-pressed={selected === null} onClick={() => onSelect(null)}
          className={`mt-1 shrink-0 rounded-md border px-3 py-3 text-left text-xs font-medium hover:bg-muted focus-visible:outline-2 ${selected === null ? "border-foreground bg-muted" : "border-border"}`}>배경</button>
      </div>
    </SortableContext>
  </DndContext>;
}
