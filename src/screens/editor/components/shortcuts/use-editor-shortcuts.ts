"use client";

import { useEffect, useEffectEvent } from "react";
import { editorShortcut, type EditorShortcut } from "./editor-shortcut";

export function useEditorShortcuts(onShortcut: (action: EditorShortcut) => boolean) {
  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    const editingText = target instanceof HTMLElement && Boolean(target.closest(
      "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='textbox']",
    ));
    const action = editorShortcut(event, editingText);
    if (!action || event.defaultPrevented) return;
    if (onShortcut(action)) event.preventDefault();
  });
  useEffect(() => {
    // Capture before sortable components consume keyboard events. Also works when focus is on body.
    const listener = (event: KeyboardEvent) => handleKey(event);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, []);
}
