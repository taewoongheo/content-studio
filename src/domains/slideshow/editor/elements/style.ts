import type { ElementStyle } from "@/domains/slideshow/editor/types";

/** Optional defaults keep previously saved visual documents compatible. */
export function withStyleDefaults(style: ElementStyle) {
  return { shadowEnabled: false, shadowColor: "#000000", shadowOpacity: 0.25, shadowBlur: 12, shadowOffsetX: 0, shadowOffsetY: 6, rotation: 0, fontStyle: "normal" as const, borderEnabled: false, borderColor: "#111111", borderWidth: 2, ...style };
}

export function validRotation(style: Partial<ElementStyle>) {
  return style.rotation === undefined || (Number.isFinite(style.rotation) && Math.abs(style.rotation) <= 360);
}

export function validBorder(style: ElementStyle) {
  return (style.borderEnabled === undefined || typeof style.borderEnabled === "boolean") &&
    (style.borderColor === undefined || /^#[0-9a-fA-F]{6}$/.test(style.borderColor)) &&
    (style.borderWidth === undefined || (Number.isFinite(style.borderWidth) && style.borderWidth >= 0 && style.borderWidth <= 100));
}

export function validShadow(style: Partial<ElementStyle>) {
  return (style.shadowEnabled === undefined || typeof style.shadowEnabled === "boolean") &&
    (style.shadowColor === undefined || /^#[0-9a-fA-F]{6}$/.test(style.shadowColor)) &&
    ([['shadowOpacity', 0, 1], ['shadowBlur', 0, 100], ['shadowOffsetX', -200, 200], ['shadowOffsetY', -200, 200]] as const)
      .every(([key, min, max]) => style[key] === undefined ||
        (Number.isFinite(style[key]) && style[key]! >= min && style[key]! <= max));
}

export function shadowAttributes(style: ElementStyle) {
  const value = withStyleDefaults(style);
  return { shadowEnabled: value.shadowEnabled, shadowColor: value.shadowColor,
    shadowOpacity: value.shadowOpacity, shadowBlur: value.shadowBlur,
    shadowOffsetX: value.shadowOffsetX, shadowOffsetY: value.shadowOffsetY };
}
