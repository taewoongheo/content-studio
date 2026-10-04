"use client";

import { useCallback, useRef, useState } from "react";

export type WorkspaceOperation = (operation: () => Promise<void>) => Promise<void>;

/** Serialize workspace changes so switching, closing, and naming cannot overlap. */
export function useWorkspaceOperation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const running = useRef(false);

  const run = useCallback<WorkspaceOperation>(async operation => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "탭을 변경하지 못했습니다.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}
