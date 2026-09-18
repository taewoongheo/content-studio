"use client";

import { useMemo, useSyncExternalStore } from "react";

export type ProductContext = {
  name: string;
  description: string;
  audience: string;
  constraints: string;
};

const STORAGE_KEY = "content-studio.product-context.v1";
const CHANGE_EVENT = "content-studio:product-context";
const UNAVAILABLE = "storage-unavailable";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return UNAVAILABLE;
  }
}

function getServerSnapshot() {
  return undefined;
}

function parseContext(raw: string | null | undefined): ProductContext | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const data = value as Record<string, unknown>;
    if (
      typeof data.name !== "string" ||
      !data.name.trim() ||
      data.name.length > 80 ||
      typeof data.description !== "string" ||
      !data.description.trim() ||
      data.description.length > 2000 ||
      typeof data.audience !== "string" ||
      data.audience.length > 200 ||
      typeof data.constraints !== "string" ||
      data.constraints.length > 2000
    )
      return null;
    return {
      name: data.name,
      description: data.description,
      audience: data.audience,
      constraints: data.constraints,
    };
  } catch {
    return null;
  }
}

export function useProductContext() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const context = useMemo(() => parseContext(raw), [raw]);
  function saveContext(value: ProductContext) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return {
    context,
    loaded: raw !== undefined,
    storageError:
      raw === UNAVAILABLE
        ? "브라우저 저장소를 사용할 수 없습니다. 저장소 접근을 허용한 뒤 다시 시도해 주세요."
        : raw && !context
          ? "저장된 제품 정보를 읽을 수 없습니다. 제품 컨텍스트를 다시 저장해 주세요."
          : "",
    saveContext,
  };
}
