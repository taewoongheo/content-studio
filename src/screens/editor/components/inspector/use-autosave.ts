"use client";

import { useEffect, useRef, useState } from "react";
import type { EditorCommand } from "@/lib/content-jobs/editor/types";

export function useAutosave(commands: EditorCommand[], enabled: boolean, onSave: (commands: EditorCommand[]) => Promise<boolean>) {
  const saveRef = useRef(onSave);
  const [saving, setSaving] = useState(false);
  const [failedSignature, setFailedSignature] = useState("");
  const lastSubmitted = useRef("");
  const signature = JSON.stringify(commands);

  useEffect(() => { saveRef.current = onSave; }, [onSave]);

  useEffect(() => {
    if (!enabled || commands.length === 0 || saving || signature === lastSubmitted.current || signature === failedSignature)
      return;
    const timer = window.setTimeout(() => {
      const pending = JSON.parse(signature) as EditorCommand[];
      setSaving(true);
      void saveRef.current(pending).then((saved) => {
        if (saved) {
          lastSubmitted.current = signature;
          setFailedSignature("");
        } else {
          setFailedSignature(signature);
        }
      }).finally(() => setSaving(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [enabled, signature, saving, failedSignature, commands.length]);

  return { saving, failed: failedSignature === signature && commands.length > 0 };
}
