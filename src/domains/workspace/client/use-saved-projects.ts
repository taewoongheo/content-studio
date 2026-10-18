"use client";

import type { VideoSummary } from "@/domains/video/domain/model";
import { listVideoProjects } from "@/domains/video/client/api";
import { useEffect, useState } from "react";
import type { SavedProjectSummary } from "@/domains/slideshow/domain/projects";
import { listContentProjects, listContentTemplates } from "@/domains/slideshow/client/projects-api";

/** Coalesce save notifications and reconnects so older requests cannot overwrite newer lists. */
export function useSavedProjects(enabled = true) {
  const [projects, setProjects] = useState<SavedProjectSummary[]>([]);
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [templates, setTemplates] = useState<SavedProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let refreshing = false;
    let requested = false;
    async function refresh() {
      requested = true;
      if (refreshing) return;
      refreshing = true;
      try {
        while (active && requested) {
          requested = false;
          try {
            const [items, templateItems, videoItems] = await Promise.all([listContentProjects(), listContentTemplates(), listVideoProjects()]);
            if (active) { setProjects(items); setTemplates(templateItems); setVideos(videoItems); setError(""); }
          } catch (cause) {
            if (active) setError(cause instanceof Error ? cause.message : "프로젝트를 불러오지 못했습니다.");
          } finally { if (active) setLoading(false); }
        }
      } finally { refreshing = false; }
    }
    const events = new EventSource("/api/content-projects");
    // The stream sends an initial event too, so initial load and reconnect use the same path.
    events.onmessage = () => { void refresh(); };
    events.onerror = () => { void refresh(); };
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { active = false; events.close(); window.removeEventListener("focus", onFocus); };
  }, [enabled]);

  return { projects, videos, templates, loading, error, setError };
}
