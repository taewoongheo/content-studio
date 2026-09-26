"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Layers3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ScopeChoice, visualScopeLabel } from "./element-scope";

type Props = {
  currentSlideId: string;
  slides: Array<{ slideId: string; label: string }>;
  selectedSlideIds: string[];
  isBackground: boolean;
  disabled: boolean;
  onChange: (choice: ScopeChoice) => Promise<void>;
};

export function ElementScopePicker({ currentSlideId, slides, selectedSlideIds, isBackground, disabled, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const allSelected = selectedSlideIds.length === slides.length;

  async function choose(choice: ScopeChoice) {
    if (disabled || busy) return;
    setBusy(true);
    try { await onChange(choice); }
    finally { setBusy(false); }
  }

  return (
    <Popover.Root>
      <Popover.Trigger render={<Button variant="outline" size="sm" disabled={disabled || busy} />}>
        <Layers3 aria-hidden="true" /> 적용: {visualScopeLabel(selectedSlideIds.length, slides.length)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="start" sideOffset={8} collisionPadding={12} className="z-50">
          <Popover.Popup className="w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg outline-none">
            <Popover.Title className="text-sm font-semibold">{isBackground ? "배경색" : "위치·스타일"} 적용 범위</Popover.Title>
            {!isBackground && <Popover.Description className="mt-1 text-xs text-muted-foreground">내용은 현재 장에서만 바뀝니다.</Popover.Description>}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant={selectedSlideIds.length === 1 ? "secondary" : "outline"} size="sm" disabled={disabled || busy} onClick={() => void choose("current")}>현재 장</Button>
              <Button variant={allSelected ? "secondary" : "outline"} size="sm" disabled={disabled || busy} onClick={() => void choose("all")}>전체</Button>
            </div>
            {slides.length > 1 && <div className="mt-3 max-h-44 space-y-0.5 overflow-y-auto border-t pt-2">
              {slides.map((slide) => {
                const isCurrent = slide.slideId === currentSlideId;
                return <label key={slide.slideId} className="flex min-h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted">
                  <input type="checkbox" checked={selectedSlideIds.includes(slide.slideId)} disabled={disabled || busy || isCurrent}
                    onChange={(event) => void choose({ slideId: slide.slideId, checked: event.target.checked })} />
                  <span className="flex-1">{slide.label}</span>
                  {isCurrent && <span className="text-xs text-muted-foreground">현재</span>}
                </label>;
              })}
            </div>}
            {allSelected && slides.length > 1 && !isBackground && <p className="mt-3 border-t pt-2 text-xs leading-5 text-muted-foreground">위치를 바꾸면 전체 위치가 통일됩니다. 바꾼 스타일은 기존 개별값을 덮습니다.</p>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
