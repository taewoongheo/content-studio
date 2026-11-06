import { editorShortcut, type EditorShortcut } from "./editor-shortcut";

type ShortcutEvent = Parameters<typeof editorShortcut>[0] & {
  defaultPrevented: boolean;
  preventDefault: () => void;
  stopImmediatePropagation: () => void;
};

export function dispatchEditorShortcut(
  event: ShortcutEvent,
  context: { editingText: boolean; hasSelectedText: boolean; dialogOpen: boolean },
  onShortcut: (action: EditorShortcut) => boolean,
) {
  if (event.defaultPrevented) return;
  // Recognize held shortcuts too, but run an action only on the initial keydown.
  const action = editorShortcut({ key: event.key, code: event.code,
    metaKey: event.metaKey, ctrlKey: event.ctrlKey, altKey: event.altKey, shiftKey: event.shiftKey,
    repeat: false }, context.editingText, context.hasSelectedText);
  if (!action) return;
  if (context.dialogOpen) {
    if (action === "save" || action === "toggle-scope") {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    return;
  }
  // App ownership does not depend on whether a selection/clipboard is ready.
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!event.repeat) onShortcut(action);
}
