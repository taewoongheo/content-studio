import type { ElementStyle } from "@/domains/slideshow/editor/types";

/** Optional defaults keep previously saved visual documents compatible. */
export function withStyleDefaults(style: ElementStyle) {
  return { rotation: 0, fontStyle: "normal" as const, borderEnabled: false, borderColor: "#111111", borderWidth: 2, ...style };
}

export function validRotation(style: Partial<ElementStyle>) {
  return style.rotation === undefined || (Number.isFinite(style.rotation) && Math.abs(style.rotation) <= 360);
}

export function validBorder(style: ElementStyle) {
  return (style.borderEnabled === undefined || typeof style.borderEnabled === "boolean") &&
    (style.borderColor === undefined || /^#[0-9a-fA-F]{6}$/.test(style.borderColor)) &&
    (style.borderWidth === undefined || (Number.isFinite(style.borderWidth) && style.borderWidth >= 0 && style.borderWidth <= 100));
}
