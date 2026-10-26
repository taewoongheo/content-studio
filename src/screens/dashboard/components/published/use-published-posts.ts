"use client";
import { useEffect, useState } from "react";
import type { PublishedPost } from "@/domains/content-production/domain/published-posts";
import { listPublishedPosts } from "../../api";

export function usePublishedPosts() {
  const [posts, setPosts] = useState<PublishedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let running = false;
    let requested = false;
    async function refresh() {
      requested = true;
      if (running) return;
      running = true;
      try {
        while (active && requested) {
          requested = false;
          const items = await listPublishedPosts();
          if (active) { setPosts(items); setError(""); }
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "게시 기록을 불러오지 못했습니다.");
      } finally {
        running = false;
        if (active) setLoading(false);
      }
    }
    const events = new EventSource("/api/content-projects");
    events.onmessage = () => void refresh();
    events.onopen = () => void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    void refresh();
    return () => { active = false; events.close(); window.removeEventListener("focus", onFocus); };
  }, []);
  return { posts, loading, error };
}
