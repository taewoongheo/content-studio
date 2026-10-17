"use client";

import { useEffect, useRef } from "react";
import type { VideoLayer } from "@/lib/video/domain/model";

type ShortcutActions = {
  disabled: boolean;
  selectedLayer?: VideoLayer;
  onSave: () => void;
  onHistory: (redo: boolean) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onPaste: (layer: VideoLayer) => void;
  onTogglePlayback: () => void;
};

function isTextInput(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

export function useVideoShortcuts(actions: ShortcutActions) {
  const latest = useRef(actions);
  const clipboard = useRef<VideoLayer | null>(null);
  useEffect(() => { latest.current = actions; });
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const action = latest.current;
      const command = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (command && key === "s") {
        event.preventDefault();
        if (!action.disabled) action.onSave();
        return;
      }
      if (isTextInput(event.target) || action.disabled || document.querySelector("[role=dialog]")) return;
      if (command && key === "z") {
        event.preventDefault();
        action.onHistory(event.shiftKey);
      } else if (command && key === "d") {
        event.preventDefault();
        action.onDuplicate();
      } else if (command && key === "c" && action.selectedLayer) {
        event.preventDefault();
        clipboard.current = structuredClone(action.selectedLayer);
      } else if (command && key === "v" && clipboard.current) {
        event.preventDefault();
        action.onPaste({ ...structuredClone(clipboard.current), id: crypto.randomUUID() });
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        action.onRemove();
      } else if (event.code === "Space" && !(event.target instanceof Element && event.target.closest("button, a[href], summary, [role=button], [role=slider], [role=checkbox], [role=radio], [role=switch], [role=tab], [role=menuitem]"))) {
        event.preventDefault();
        action.onTogglePlayback();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
}
