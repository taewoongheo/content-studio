"use client";
import { useEffect, useRef, type RefObject } from "react";
import { Panel, useReactFlow, useStore } from "@xyflow/react";
import { LocateFixed, Square, RotateCcw } from "lucide-react";

export function CenterInitialStart() {
  const centered = useRef(false);
  const { setCenter, viewportInitialized } = useReactFlow();
  const size = useStore(state => state.nodeLookup.get("start")?.measured);
  useEffect(() => {
    if (centered.current || !viewportInitialized || !size?.width || !size.height) return;
    centered.current = true;
    void setCenter(size.width / 2, size.height / 2, { zoom: 1 });
  }, [viewportInitialized, size?.width, size?.height, setCenter]);
  return null;
}

export function StartNodeControl({ onStop, stopDisabled, onReset, resetDisabled }: { onStop: () => void; stopDisabled: boolean; onReset: () => void; resetDisabled: boolean }) {
  const { getNode, setCenter, fitView } = useReactFlow();
  const duration = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250;
  return <Panel position="bottom-center" className="flex gap-2">
    <button type="button" className="production-button shadow-sm" aria-label="시작 노드로 이동" onClick={() => {
      const node = getNode("start");
      if (node) void setCenter(node.position.x + (node.measured?.width ?? 300) / 2, node.position.y + (node.measured?.height ?? 120) / 2, { zoom: 1, duration: duration() });
    }}><LocateFixed size={15} />시작 노드</button>
    <button type="button" className="production-button shadow-sm" aria-label="전체 흐름 보기" onClick={() => void fitView({ padding: 0.15, maxZoom: 1, duration: duration() })}>전체 보기</button>
    <button type="button" className="production-button shadow-sm !text-destructive" disabled={stopDisabled} onClick={onStop}><Square size={14} />전체 중단</button>
    <button type="button" className="production-button shadow-sm !text-destructive" disabled={resetDisabled} onClick={onReset}><RotateCcw size={15} />초기화</button>
  </Panel>;
}


export function HorizontalWheelPan({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const { getViewport, setViewport } = useReactFlow();
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || (event.target instanceof Element && event.target.closest(".nowheel"))) return;
      if (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      const delta = event.deltaX || (event.shiftKey ? event.deltaY : 0);
      if (!delta) return;
      event.preventDefault();
      event.stopPropagation();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? container.clientWidth : 1;
      const current = getViewport();
      void setViewport({ ...current, x: current.x - delta * unit });
    };
    container.addEventListener("wheel", wheel, { passive: false, capture: true });
    return () => container.removeEventListener("wheel", wheel, { capture: true });
  }, [containerRef, getViewport, setViewport]);
  return null;
}
