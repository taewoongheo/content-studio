"use client";

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoredAsset } from "@/lib/local-db/assets";
import { imagePickerPosition } from "./picker-position";

export function ImageLibraryPicker({ anchorRef, disabled, onSelect, onAddEmpty, onClose }: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  disabled: boolean;
  onSelect: (asset: StoredAsset) => Promise<boolean>;
  onAddEmpty: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [assets, setAssets] = useState<StoredAsset[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState<ReturnType<typeof imagePickerPosition> | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const focused = useRef(false);

  useLayoutEffect(() => {
    function updatePosition() {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      setPosition(imagePickerPosition(anchor, { width: window.innerWidth, height: window.innerHeight }));
    }
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    if (position && !focused.current) {
      closeRef.current?.focus();
      focused.current = true;
    }
  }, [position]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/library", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("저장된 이미지를 불러오지 못했습니다.");
        const library = await response.json() as { assets: StoredAsset[] };
        setAssets(library.assets);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "저장된 이미지를 불러오지 못했습니다.");
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function choose(action: () => Promise<boolean>) {
    setBusy(true);
    setError("");
    try {
      if (await action()) onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "이미지를 추가하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!position) return null;
  return createPortal(<>
    <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="이미지 목록 닫기" onClick={() => {
      if (!busy) onClose();
    }} />
    <div id="editor-image-library" role="dialog" aria-label="저장된 이미지 선택"
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border bg-background p-3 shadow-lg"
      style={position}>
    <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
      <h3 className="text-sm font-semibold">저장된 이미지</h3>
      <Button ref={closeRef} type="button" variant="ghost" size="icon-sm" aria-label="이미지 목록 닫기" disabled={busy} onClick={onClose}>
        <X className="size-4" aria-hidden="true" />
      </Button>
    </div>
    {error && <p role="alert" className="mb-2 text-xs text-destructive">{error}</p>}
    {assets === null && !error ? <p role="status" className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> 이미지 불러오는 중…
    </p> : assets?.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">저장된 이미지가 없습니다.</p> :
      <div className="grid min-h-0 grid-cols-1 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2" role="list">
        {assets?.map((asset) => <div key={asset.id} role="listitem">
          <button type="button" disabled={disabled || busy} onClick={() => void choose(() => onSelect(asset))}
            className="flex w-full min-w-0 items-center gap-2 rounded-lg border p-2 text-left hover:border-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50">
            <Image src={`/api/library/assets/${encodeURIComponent(asset.id)}`} alt="" width={56} height={56} unoptimized
              className="size-14 shrink-0 rounded-md bg-muted object-cover" />
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium">{asset.name}</span>
              {asset.description && <span className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{asset.description}</span>}
            </span>
          </button>
        </div>)}
      </div>}
    <div className="mt-3 shrink-0 border-t pt-3">
      <Button type="button" variant="outline" size="sm" disabled={disabled || busy}
        onClick={() => void choose(onAddEmpty)}>빈 이미지 Element 추가</Button>
    </div>
    </div>
  </>, document.body);
}
