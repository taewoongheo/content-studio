import { clipboardShortcut } from "../clipboard/element-clipboard";

export type EditorShortcut = "copy" | "paste" | "undo";
type ShortcutEvent = Parameters<typeof clipboardShortcut>[0];

export function editorShortcut(event: ShortcutEvent, editingText: boolean): EditorShortcut | null {
  const clipboard = clipboardShortcut(event, editingText);
  if (clipboard) return clipboard;
  if (editingText || event.repeat || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) return null;
  const undoKey = event.code ? event.code === "KeyZ" : event.key.toLowerCase() === "z";
  return undoKey ? "undo" : null;
}
