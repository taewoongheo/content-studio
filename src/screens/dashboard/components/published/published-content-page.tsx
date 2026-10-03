"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublishedPost } from "@/lib/local-db/published-posts";
import { deletePublishedPost, listPublishedPosts } from "../../api";
import { PublishedCalendar } from "./published-calendar";

export function PublishedContentPage() {
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const items = await listPublishedPosts();
    setPosts(items);
  }, []);

  useEffect(() => {
    let active = true;
    void listPublishedPosts().then((items) => { if (active) setPosts(items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "게시 기록을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function removePost(post: PublishedPost) {
    if (!window.confirm(`“${post.title}” 기록을 로컬 DB에서 삭제할까요? 실제 게시물은 삭제되지 않습니다.`)) return;
    setBusy(true); setError("");
    try { await deletePublishedPost(post.id); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "삭제하지 못했습니다."); }
    finally { setBusy(false); }
  }

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
              <div className="min-w-0"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="font-medium">{post.title}</span><span className="text-xs text-muted-foreground">{post.publishedOn} · {post.platform}</span></div>
                {post.notes && <p className="mt-1 text-sm text-muted-foreground">{post.notes}</p>}
                {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm underline underline-offset-2">게시물 열기</a>}
              </div>
              <Button type="button" size="icon" variant="ghost" className="shrink-0 text-destructive hover:text-destructive" aria-label={`${post.title} 로컬 기록 삭제`} disabled={busy} onClick={() => void removePost(post)}><Trash2 aria-hidden="true" /></Button>
            </article>)}</div>}
        </section>
      </div>}
    </div>
  );
}
