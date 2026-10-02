type Anchor = { left: number; top: number; bottom: number };

export function imagePickerPosition(anchor: Anchor, viewport: { width: number; height: number }) {
  const margin = 16;
  const gap = 8;
  const width = Math.max(0, Math.min(480, viewport.width - margin * 2));
  const left = Math.max(margin, Math.min(anchor.left, viewport.width - width - margin));
  const above = Math.max(0, anchor.top - gap - margin);
  const below = Math.max(0, viewport.height - anchor.bottom - gap - margin);
  return above >= below
    ? { left, width, bottom: Math.max(margin, viewport.height - anchor.top + gap), maxHeight: Math.min(480, above) }
    : { left, width, top: Math.max(margin, anchor.bottom + gap), maxHeight: Math.min(480, below) };
}
