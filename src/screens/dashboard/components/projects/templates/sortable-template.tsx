"use client";
import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function SortableTemplate({ id, name, disabled, children }: { id: string; name: string; disabled: boolean; children: ReactNode }) {
  const { setNodeRef, setActivatorNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id, disabled });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
    className={`relative flex gap-2 ${isDragging ? "z-10 rounded-md bg-muted shadow-sm" : ""}`}>
    <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} disabled={disabled}
      aria-label={`${name} 템플릿 순서 이동`} title="드래그하거나 Space와 방향키로 순서를 이동하세요."
      className="mt-4 flex size-11 shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 cursor-grab active:cursor-grabbing"><GripVertical className="size-4" aria-hidden="true" /></button>
    <div className="min-w-0 flex-1">{children}</div>
  </div>;
}
