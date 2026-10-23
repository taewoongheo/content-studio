"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePublishedPosts } from "./use-published-posts";
import { ProjectMetadataButton } from "../projects/project-metadata-button";
import { PublishedCalendar } from "./published-calendar";

export function PublishedContentPage() {
  const { posts, loading, error } = usePublishedPosts();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const visiblePosts = selectedDate ? posts.filter((post) => post.publishedOn === selectedDate) : posts;

  return (
    <div className="grid gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">게시 콘텐츠</h1>
          <p className="mt-2 text-sm text-muted-foreground">로컬 DB의 게시 기록을 날짜별로 확인하세요.</p>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading ? <p role="status" className="text-sm text-muted-foreground">게시 기록을 불러오는 중…</p> : <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,22rem)]">
        <PublishedCalendar posts={posts} month={month} selectedDate={selectedDate} onMonthChange={(next) => { setMonth(next); setSelectedDate(null); }}
          onSelectDate={(date) => setSelectedDate((current) => current === date ? null : date)} />
        <section aria-labelledby="post-list-title" className="grid min-w-0 gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="post-list-title" className="text-lg font-semibold">{selectedDate ? `${selectedDate} 게시 기록` : "전체 게시 기록"} <span className="text-muted-foreground">{visiblePosts.length}</span></h2>
            {selectedDate && <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>전체 보기</Button>}
          </div>
          {visiblePosts.length === 0 ? <p className="rounded-xl border border-dashed px-5 py-8 text-sm text-muted-foreground">{selectedDate ? "이 날짜에 등록된 게시물이 없습니다." : "아직 등록된 게시물이 없습니다."}</p> :
            <div role="region" aria-label="게시 기록 목록" tabIndex={0} className="max-h-[34rem] divide-y overflow-y-auto rounded-lg border">{visiblePosts.map((post) => <article key={post.id} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><a href={post.postUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">{post.title}</a><span className="text-xs text-muted-foreground">{post.publishedOn}</span></div>
                {post.message && <p className="mt-1 text-sm text-muted-foreground">{post.message}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{post.topic}</p>
                <div className="mt-2"><ProjectMetadataButton project={post} /></div>
              </div>
            </article>)}</div>}
        </section>
      </div>}
    </div>
  );
}
