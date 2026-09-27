"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublishedPost } from "@/lib/local-db/published-posts";
import { localDateKey, monthCells } from "./calendar-model";

const weekdays = ["월", "화", "수", "목", "금", "토", "일"];

export function PublishedCalendar({ posts, month, selectedDate, onMonthChange, onSelectDate }: {
  posts: PublishedPost[];
  month: Date;
  selectedDate: string | null;
  onMonthChange: (month: Date) => void;
  onSelectDate: (date: string) => void;
}) {
  const cells = useMemo(() => monthCells(month.getFullYear(), month.getMonth()), [month]);
  const byDate = useMemo(() => {
    const grouped = new Map<string, PublishedPost[]>();
    for (const post of posts) {
      const existing = grouped.get(post.publishedOn);
      if (existing) existing.push(post);
      else grouped.set(post.publishedOn, [post]);
    }
    return grouped;
  }, [posts]);
  const today = localDateKey(new Date());

  return (
    <section className="overflow-hidden rounded-xl border bg-card" aria-label="게시 달력">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-base font-semibold">{month.getFullYear()}년 {month.getMonth() + 1}월</h2>
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant="ghost" aria-label="이전 달" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft aria-hidden="true" /></Button>
          <Button type="button" size="icon" variant="ghost" aria-label="다음 달" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight aria-hidden="true" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 border-b bg-muted/35 text-center text-xs font-medium text-muted-foreground">
        {weekdays.map((day) => <span key={day} className="py-2">{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {cells.map((date, index) => {
          const dayPosts = date ? byDate.get(date) ?? [] : [];
          return date ? (
            <button key={date} type="button" onClick={() => onSelectDate(date)}
              aria-label={`${date}, 게시물 ${dayPosts.length}개`}
              aria-pressed={selectedDate === date}
              className={`min-h-20 min-w-0 bg-card p-2 text-left align-top transition-colors hover:bg-accent focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring max-sm:min-h-14 max-sm:p-1.5 ${selectedDate === date ? "bg-accent" : ""}`}>
              <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${date === today ? "bg-foreground text-background" : ""}`}>{Number(date.slice(-2))}</span>
              {dayPosts.length > 0 && <span className="mt-1 block rounded bg-foreground px-1.5 py-1 text-[11px] leading-tight text-background max-sm:hidden">
                <span className="block truncate">{dayPosts[0].title}</span>
              </span>}
              {dayPosts.length > 1 && <span className="mt-0.5 block text-[11px] text-muted-foreground max-sm:hidden">+{dayPosts.length - 1}개</span>}
              {dayPosts.length > 0 && <span className="mt-1 block size-1.5 rounded-full bg-foreground sm:hidden" aria-hidden="true" />}
            </button>
          ) : <span key={`empty-${index}`} className="min-h-20 bg-muted/20 max-sm:min-h-14" aria-hidden="true" />;
        })}
      </div>
    </section>
  );
}
