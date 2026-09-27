"use client";

import { Button } from "@/components/ui/button";
import type { EditorJobState, EditorProposalSet, EditorProposalTarget } from "@/lib/content-jobs/editor/types";

export function ProposalCards({ set, editor, selected, disabled, onSelect, onApply }: {
  set: EditorProposalSet;
  editor: EditorJobState;
  selected: EditorProposalTarget | null;
  disabled: boolean;
  onSelect: (target: EditorProposalTarget) => void;
  onApply: (target: EditorProposalTarget) => void;
}) {
  const firstSlide = editor.document?.slides[0];
  const hookValue = firstSlide?.placements.find((placement) =>
    editor.document?.elements.some((element) => element.id === placement.elementId && element.kind === "text"))?.value;
  return (
    <section className="grid gap-2" aria-label={set.kind === "topic" ? "주제 후보" : "훅 후보"}>
      {set.items.map((item) => {
        const target = { setId: set.id, candidateId: item.id };
        const isSelected = selected?.setId === set.id && selected.candidateId === item.id;
        const isApplied = set.kind === "topic"
          ? editor.selectedTopic?.id === item.id && editor.selectedTopic.title === (item as { title: string }).title &&
            editor.selectedTopic.angle === (item as { angle: string }).angle
          : editor.selectedHookId === item.id && hookValue === (item as { text: string }).text;
        return (
          <div key={item.id} className={`rounded-lg border text-sm ${isSelected ? "border-foreground bg-muted/60" : "bg-background"}`}>
            <button type="button" aria-pressed={isSelected} disabled={disabled || set.stale}
              className="w-full rounded-lg p-3 text-left transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onSelect(target)}>
              <span className="flex items-center justify-between gap-2 font-semibold">
                <span>{set.kind === "topic" ? (item as { title: string }).title : (item as { text: string }).text}</span>
                {isApplied && <span className="shrink-0 text-xs font-normal text-muted-foreground">적용됨</span>}
              </span>
              <span className="mt-1 block text-muted-foreground">
                {set.kind === "topic" ? `${(item as { angle: string }).angle} · ${item.rationale}` : item.rationale}
              </span>
            </button>
            {set.kind === "topic" && (item as { sourceUrls: string[] }).sourceUrls.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-2 text-xs">
                {(item as { sourceUrls: string[] }).sourceUrls.map((url, index) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                    근거 {index + 1}
                  </a>
                ))}
              </div>
            )}
            {isSelected && (
              <div className="flex justify-end border-t px-3 py-2">
                <Button size="sm" disabled={disabled || set.stale} onClick={() => onApply(target)}>적용</Button>
              </div>
            )}
          </div>
        );
      })}
      {set.stale && <p className="text-xs text-muted-foreground">본문이 바뀌어 이 훅 후보는 다시 생성해야 합니다.</p>}
    </section>
  );
}
