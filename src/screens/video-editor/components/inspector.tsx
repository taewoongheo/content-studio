import { changeVideoFps } from "@/domains/video/domain/settings";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import type { RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import { SplitControl } from "./playback/split-control";
import { ColorField, Field, NumberField, inputClass } from "./fields";
import type { VideoDocument, VideoLayer } from "@/domains/video/domain/model";
export function VideoInspector({ document: doc, layer: l, onDocument, onLayer, player, initialFrame, onSplit, aspectRatioLocked, onAspectRatioLockedChange }: {
  document: VideoDocument; layer?: VideoLayer; onDocument: (doc: VideoDocument) => void; onLayer: (layer: VideoLayer) => void; player: RefObject<PlayerRef | null>; initialFrame: number; onSplit: () => void;
  aspectRatioLocked: boolean; onAspectRatioLockedChange: (locked: boolean) => void;
}) {
  const patch = (values: object) => { if (l) onLayer({ ...l, ...values } as VideoLayer); };
  function dimension(key: "width" | "height", value: number) {
    if (!l) return;
    const pixels = value / 100 * (key === "width" ? doc.width : doc.height);
    if (aspectRatioLocked && (l.kind === "video" || l.kind === "image")) {
      const factor = Math.max(1 / Math.min(l.width, l.height), Math.min(7680 / Math.max(l.width, l.height), pixels / l[key]));
      patch({ width: Math.max(1, Math.round(l.width * factor)), height: Math.max(1, Math.round(l.height * factor)) });
    } else patch({ [key]: Math.max(1, Math.min(7680, pixels)) });
  }
  return <div className="grid min-w-0 gap-5 p-4">
    {!l ? <>
      <div className="text-sm font-semibold">배경</div>
      <Field label="배경색"><div className="flex items-center gap-3 rounded-lg border bg-background p-3"><input aria-label="영상 배경색" type="color" className="size-10 shrink-0 cursor-pointer rounded-md border bg-background p-1" value={doc.backgroundColor} onChange={e => onDocument({ ...doc, backgroundColor: e.target.value })} /><span className="font-mono text-xs text-muted-foreground">{doc.backgroundColor.toUpperCase()}</span></div></Field>
      <section className="grid gap-3 border-t pt-5"><h2 className="text-sm font-semibold">영상 설정</h2>
        <Field label="FPS"><select className={inputClass} value={doc.fps} onChange={e => {
          onDocument(changeVideoFps(doc, Number(e.target.value) as VideoDocument["fps"]));
        }}>{[24,25,30,60].map(fps => <option key={fps}>{fps}</option>)}</select></Field>
        <NumberField label="최소 영상 길이 (초)" value={doc.duration / doc.fps} min={1 / doc.fps} max={108000 / doc.fps} step={0.1} onChange={n => onDocument({ ...doc, duration: Math.max(1, Math.round(n * doc.fps)) })} />
      </section>
    </> : <>
      <div className="grid gap-3">
        <Field label="이름"><input className={inputClass} value={l.name} maxLength={120} onChange={e => patch({ name: e.target.value || "Element" })} /></Field>
        {l.kind === "text" && <Field label="텍스트"><textarea className={`${inputClass} h-28 py-2`} value={l.text} onChange={e => patch({ text: e.target.value })} /></Field>}
      </div>
      {l.kind !== "audio" && <section className="grid gap-3 border-t pt-5">
        <h2 className="text-sm font-semibold">위치·스타일</h2>
        <div className="grid min-w-0 grid-cols-2 gap-3 [&>*]:min-w-0">
          <NumberField label="X (%)" value={l.x / doc.width * 100} min={-7680 / doc.width * 100} max={7680 / doc.width * 100} step={0.1} onChange={n => patch({ x: n / 100 * doc.width })} />
          <NumberField label="Y (%)" value={l.y / doc.height * 100} min={-7680 / doc.height * 100} max={7680 / doc.height * 100} step={0.1} onChange={n => patch({ y: n / 100 * doc.height })} />
          <NumberField label={l.kind === "text" ? "영역 너비 (%)" : "너비 (%)"} value={l.width / doc.width * 100} min={1 / doc.width * 100} max={7680 / doc.width * 100} step={0.1} onChange={n => dimension("width", n)} />
          <NumberField label={l.kind === "text" ? "영역 높이 (%)" : "높이 (%)"} value={l.height / doc.height * 100} min={1 / doc.height * 100} max={7680 / doc.height * 100} step={0.1} onChange={n => dimension("height", n)} />
          <NumberField label="회전 (°)" value={l.rotation} min={-360} max={360} onChange={rotation => patch({ rotation })} />
          <NumberField label="불투명도" value={l.opacity} min={0} max={1} step={0.05} onChange={opacity => patch({ opacity })} />
        </div>
        {(l.kind === "video" || l.kind === "image") && <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={aspectRatioLocked} onChange={e => onAspectRatioLockedChange(e.target.checked)} />너비·높이 비율 유지</label>}
        {l.kind === "text" && <>
          <div className="grid grid-cols-2 gap-3"><ColorField label="글자색" value={l.color} onChange={color => patch({ color })} /><ColorField label="배경색" value={l.backgroundColor} onChange={backgroundColor => patch({ backgroundColor })} />
            <NumberField label="배경 모서리 반경 (px)" value={l.borderRadius} min={0} max={100} onChange={borderRadius => patch({ borderRadius })} /><NumberField label="배경 불투명도" value={l.backgroundOpacity} min={0} max={1} step={0.05} onChange={backgroundOpacity => patch({ backgroundOpacity })} /></div>
          <label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={l.backgroundOpacity === 0} onChange={e => patch({ backgroundOpacity: e.target.checked ? 0 : 1 })} />투명 배경</label>
          <div className="grid grid-cols-2 gap-3"><NumberField label="글자 크기" value={l.fontSize} min={8} max={400} onChange={fontSize => patch({ fontSize })} /><NumberField label="줄 높이" value={l.lineHeight ?? 1.15} min={0.5} max={3} step={0.1} onChange={lineHeight => patch({ lineHeight })} />
            <Field label="글자 굵기"><select className={inputClass} value={l.fontWeight} onChange={e => patch({ fontWeight: Number(e.target.value) })}>{(l.fontFamily === "Oswald" ? [700] : [100,200,300,400,500,600,700,800,900]).map(weight => <option key={weight}>{weight}</option>)}</select></Field>
            <label className="flex h-10 items-center gap-2 text-xs font-medium"><input type="checkbox" checked={l.italic} onChange={e => patch({ italic: e.target.checked })} /><span className="italic">이탤릭</span></label>
          </div>
          <Field label="글꼴 계열"><select className={inputClass} value={l.fontFamily} onChange={e => patch({ fontFamily: e.target.value, fontWeight: e.target.value === "Oswald" ? 700 : l.fontWeight })}><optgroup label="훅"><option value="Oswald">Oswald</option></optgroup><optgroup label="본문"><option value="Inter">Inter</option></optgroup></select></Field>
          <div className="grid gap-1.5 text-xs font-medium"><span>정렬</span><div role="group" aria-label="텍스트 정렬" className="grid h-10 grid-cols-3 overflow-hidden rounded-md border bg-background">{([{ value: "left", label: "왼쪽 정렬", Icon: AlignLeft }, { value: "center", label: "가운데 정렬", Icon: AlignCenter }, { value: "right", label: "오른쪽 정렬", Icon: AlignRight }] as const).map(({ value, label, Icon }) => <button key={value} type="button" aria-label={label} aria-pressed={l.align === value} title={label} onClick={() => patch({ align: value })} className={`grid place-items-center border-r last:border-r-0 focus-visible:z-10 focus-visible:outline-2 ${l.align === value ? "bg-foreground text-background" : "hover:bg-muted"}`}><Icon className="size-4" /></button>)}</div></div>
          <div className="grid grid-cols-2 gap-3"><NumberField label="좌우 여백 (px)" value={l.paddingX ?? l.fontSize * 0.22} min={0} max={400} onChange={paddingX => patch({ paddingX })} /><NumberField label="상하 여백 (px)" value={l.paddingY ?? l.fontSize * 0.14} min={0} max={400} onChange={paddingY => patch({ paddingY })} /></div>
        </>}
        {l.kind === "shape" && <>
          <Field label="도형"><select className={inputClass} value={l.shape} onChange={e => patch({ shape: e.target.value })}><option value="rectangle">사각형</option><option value="ellipse">원형</option><option value="triangle">삼각형</option><option value="line">선</option></select></Field>
          <div className="grid grid-cols-2 gap-3"><ColorField label="채우기 색" value={l.color} onChange={color => patch({ color })} /><ColorField label="테두리 색" value={l.strokeColor} onChange={strokeColor => patch({ strokeColor })} /><NumberField label="테두리 두께 (px)" value={l.strokeWidth} min={0} max={100} onChange={strokeWidth => patch({ strokeWidth })} /><NumberField label="모서리 반경 (px)" value={l.borderRadius} min={0} max={100} onChange={borderRadius => patch({ borderRadius })} /></div>
        </>}
        {(l.kind === "video" || l.kind === "image") && <Field label={l.kind === "video" ? "영상 맞춤" : "이미지 맞춤"}><select className={inputClass} value={l.fit} onChange={e => patch({ fit: e.target.value })}><option value="cover">영역 채우기</option><option value="contain">전체 보이기</option></select></Field>}
      </section>}
      <section className="grid gap-3 border-t pt-5"><h2 className="text-sm font-semibold">재생 구간</h2>
        <div className="grid grid-cols-2 gap-3"><NumberField label={l.kind === "video" && l.sequence ? "시작 (자동 연결)" : "시작 (초)"} value={l.from / doc.fps} min={0} max={(108000 - l.duration) / doc.fps} step={0.1} onChange={n => { if (l.kind !== "video" || !l.sequence) patch({ from: Math.round(n * doc.fps) }); }} /><NumberField label="길이 (초)" value={l.duration / doc.fps} min={1 / doc.fps} max={((l.kind === "video" || l.kind === "audio") && !l.loop ? l.trimEnd - l.trimStart : 108000 - l.from) / doc.fps} step={0.1} onChange={n => patch({ duration: Math.max(1, Math.round(n * doc.fps)) })} /></div>
        {l.kind === "text" && <NumberField label="페이드 인 (초)" value={l.fadeIn / doc.fps} min={0} max={l.duration / doc.fps} step={0.1} onChange={n => patch({ fadeIn: Math.round(n * doc.fps) })} />}
        {(l.kind === "video" || l.kind === "audio") && <>
          <div className="grid grid-cols-2 gap-3"><NumberField label="원본 시작 (초)" value={l.trimStart / doc.fps} min={0} max={(l.trimEnd - 1) / doc.fps} step={0.1} onChange={n => { const trimStart = Math.round(n * doc.fps); patch({ trimStart, duration: l.loop ? l.duration : l.trimEnd - trimStart }); }} /><NumberField label="원본 끝 (초)" value={l.trimEnd / doc.fps} min={(l.trimStart + 1) / doc.fps} max={l.sourceFrames / doc.fps} step={0.1} onChange={n => { const trimEnd = Math.round(n * doc.fps); patch({ trimEnd, duration: l.loop ? l.duration : trimEnd - l.trimStart }); }} /></div>
          {l.kind === "audio" && <p className="text-xs leading-relaxed text-muted-foreground">원본 {(l.sourceFrames / doc.fps).toFixed(2)}초 · 선택 구간 {((l.trimEnd - l.trimStart) / doc.fps).toFixed(2)}초 · 재생 속도 1배</p>}
          <NumberField label="음량" value={l.volume} min={0} max={1} step={0.05} onChange={volume => patch({ volume })} /><label className="flex items-center gap-2 text-xs font-medium"><input type="checkbox" checked={l.loop} onChange={e => patch({ loop: e.target.checked, duration: e.target.checked ? l.duration : Math.min(l.duration, l.trimEnd - l.trimStart) })} />구간 반복 재생</label>
        </>}
        {l.kind === "video" && <><div className="grid grid-cols-2 gap-3"><NumberField label="크롭 X (%)" value={l.cropX} min={0} max={100} onChange={cropX => patch({ cropX })} /><NumberField label="크롭 Y (%)" value={l.cropY} min={0} max={100} onChange={cropY => patch({ cropY })} /></div><SplitControl player={player} initialFrame={initialFrame} layer={l} onSplit={onSplit} /></>}
      </section>
    </>}
  </div>;
}
