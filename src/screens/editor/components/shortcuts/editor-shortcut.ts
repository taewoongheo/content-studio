import { clipboardShortcut } from "../clipboard/element-clipboard";

export type EditorShortcut = "copy" | "paste" | "undo";
type ShortcutEvent = Parameters<typeof clipboardShortcut>[0];

export function editorShortcut(event: ShortcutEvent, editingText: boolean, hasSelectedText = false): EditorShortcut | null {
  const clipboard = clipboardShortcut(event, editingText);
  // Browser text selection takes priority over the editor's in-memory Element clipboard.
  if (clipboard) return hasSelectedText ? null : clipboard;
  if (editingText || event.repeat || event.altKey || event.shiftKey || !(event.metaKey || event.ctrlKey)) return null;
  const undoKey = event.code ? event.code === "KeyZ" : event.key.toLowerCase() === "z";
  return undoKey ? "undo" : null;
}
