import type { ElementStyle } from "../types";

/** Optional defaults keep previously saved visual documents compatible. */
export function withBorderDefaults(style: ElementStyle) {
  return { borderEnabled: false, borderColor: "#111111", borderWidth: 2, ...style };
}

export function validBorder(style: ElementStyle) {
  return (style.borderEnabled === undefined || typeof style.borderEnabled === "boolean") &&
    (style.borderColor === undefined || /^#[0-9a-fA-F]{6}$/.test(style.borderColor)) &&
    (style.borderWidth === undefined || (Number.isFinite(style.borderWidth) && style.borderWidth >= 0 && style.borderWidth <= 100));
}
