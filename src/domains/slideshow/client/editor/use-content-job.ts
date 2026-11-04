"use client";
import { subscribeBackgroundEvents } from "@/domains/workspace/client/editor-load-priority";

import { useCallback, useEffect, useState } from "react";
import type { ContentJobSnapshot } from "@/domains/slideshow/domain/types";
import { postContentJobAction } from "@/domains/slideshow/client/editor/api";

export function useContentJob(initialJob: ContentJobSnapshot) {
  const [job, setJob] = useState(initialJob);
  const [submitting, setSubmitting] = useState(false);
  const [clientError, setClientError] = useState("");

  useEffect(() => {
    return subscribeBackgroundEvents(() => {
    const events = new EventSource(
      `/api/content-jobs/${encodeURIComponent(initialJob.id)}`,
    );
    events.addEventListener("closed", () => events.close());
    events.onmessage = (event) => {
      const next = JSON.parse(event.data) as ContentJobSnapshot;
      // Reconnecting after artwork loads must not redraw an unchanged document.
      setJob(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      setClientError("");
    };
    events.onerror = () => {
      setClientError(
        "작업 상태 연결이 끊어졌습니다. 자동으로 다시 연결하는 중입니다.",
      );
    };
    return () => events.close();
    });
  }, [initialJob.id]);

  const send = useCallback(
    async (body: Record<string, unknown>) => {
      setSubmitting(true);
      setClientError("");
      try {
        const updated = await postContentJobAction(initialJob.id, { ...body, expectedTabId: initialJob.tabId });
        setJob(updated);
        return updated;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
        setClientError(message);
        throw error;
      } finally {
        setSubmitting(false);
      }
    },
    [initialJob.id, initialJob.tabId],
  );

  return { job, submitting, clientError, send };
}
