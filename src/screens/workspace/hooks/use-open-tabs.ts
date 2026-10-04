"use client";
import { useEffect, useRef, useState } from "react";
import type { OpenProjectTab } from "@/lib/content-jobs/domain/types";

export function useOpenTabs(onChange: (tabs: OpenProjectTab[]) => void) {
  const change = useRef(onChange);
  useEffect(() => { change.current = onChange; }, [onChange]);
  const [tabs, setTabs] = useState<OpenProjectTab[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const events = new EventSource("/api/content-jobs");
    events.onmessage = event => { const next = JSON.parse(event.data) as OpenProjectTab[]; setTabs(next); setError(""); change.current(next); };
    events.onerror = () => setError("열린 탭 연결을 다시 시도하는 중입니다.");
    return () => events.close();
  }, []);
  return { tabs, error };
}
