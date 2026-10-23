import { Play, Square, Trash2 } from "lucide-react";
import type { StageControl } from "../../../model/task-controls";

export function StageControlButton({ title, control }: { title: string; control?: StageControl }) {
  if (!control?.action) return null;
  const isDelete = control.action === "delete_post";
  const label = isDelete ? "포스트 삭제" : control.action === "stop" ? "멈춤" : "재생";
  const Icon = isDelete ? Trash2 : control.action === "stop" ? Square : Play;
  return <button
    type="button"
    className={`production-node-button nodrag nopan ${isDelete ? "is-destructive" : ""}`}
    aria-label={isDelete ? label : `${title} ${label}`}
    title={label}
    disabled={control.disabled}
    onClick={event => { event.stopPropagation(); control.onAction(); }}
  >
    <Icon size={isDelete ? 16 : 18} />{isDelete ? "삭제" : null}
  </button>;
}
