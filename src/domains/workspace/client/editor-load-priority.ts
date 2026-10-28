/** Reserve browser connections for foreground editor loads before issuing more background work. */
export function createEditorLoadPriority() {
  const listeners = new Set<(paused: boolean) => void>();
  let loading = 0;
  return {
    subscribe(listener: (paused: boolean) => void) {
      listeners.add(listener);
      listener(loading > 0);
      return () => { listeners.delete(listener); };
    },
    begin() {
      if (++loading === 1) for (const listener of listeners) listener(true);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (--loading === 0) for (const listener of listeners) listener(false);
      };
    },
  };
}
export const editorLoadPriority = createEditorLoadPriority();
