"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** The debounce and explicit flush share one request, so switching tabs cannot submit twice. */
export function useAutosave<T>(commands: T[], enabled: boolean, onSave: (commands: T[]) => Promise<boolean>) {
  const signature = JSON.stringify(commands);
  const latest = useRef({ signature, enabled, onSave });
  const submitted = useRef("");
  const pending = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [failedSignature, setFailedSignature] = useState("");
  useEffect(() => { latest.current = { signature, enabled, onSave }; }, [signature, enabled, onSave]);

  const flushPending = useCallback(async function flush(): Promise<boolean> {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (pending.current) { if (!(await pending.current)) return false; return flush(); }
    const current = latest.current;
    if (current.signature === "[]" || current.signature === submitted.current) return true;
    if (!current.enabled) return false;
    setSaving(true);
    const operation = current.onSave(JSON.parse(current.signature) as T[]).catch(() => false);
    pending.current = operation;
    const saved = await operation;
    pending.current = null;
    if (saved) { submitted.current = current.signature; setFailedSignature(""); }
    else setFailedSignature(current.signature);
    setSaving(false);
    return saved;
  }, []);

  useEffect(() => {
    if (!enabled || commands.length === 0 || saving || signature === submitted.current || signature === failedSignature) return;
    timer.current = setTimeout(() => { void flushPending(); }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  }, [enabled, commands.length, saving, signature, failedSignature, flushPending]);

  return { saving, failed: failedSignature === signature && commands.length > 0, flushPending };
}
