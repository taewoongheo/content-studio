"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchProduction,
  type ProductionSnapshot,
  productionAction,
} from "@/domains/content-production/client";
import type { ChangeEvent } from "@/domains/content-production/domain/contracts";
export function useProduction() {
  const [data, setData] = useState<ProductionSnapshot | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [writes, setWrites] = useState<Record<string, number>>({}),
    [activity, setActivity] = useState<Record<string, string>>({});
  const mounted = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    inflight = useRef(false),
    queued = useRef(false);
  const reload = useCallback(async () => {
    if (inflight.current) {
      queued.current = true;
      return;
    }
    inflight.current = true;
    try {
      do {
        queued.current = false;
        const snapshot = await fetchProduction<ProductionSnapshot>();
        if (mounted.current) setData(snapshot);
      } while (queued.current && mounted.current);
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "조회 실패");
    } finally {
      inflight.current = false;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => void reload());
    const events = new EventSource("/api/content-production");
    events.onopen = () => void reload();
    events.onmessage = (message) => {
      const event = JSON.parse(message.data) as ChangeEvent;
      if (event.kind === "saved" && event.task_id && event.step) {
        const key = `${event.task_id}:${event.step}`;
        setWrites((previous) => ({
          ...previous,
          [key]: (previous[key] ?? 0) + 1,
        }));
      }
      if (event.task_id && event.detail)
        setActivity((previous) => ({
          ...previous,
          [event.task_id!]: event.detail!,
        }));
      if (!timer.current)
        timer.current = setTimeout(() => {
          timer.current = undefined;
          void reload();
        }, 120);
    };
    return () => {
      mounted.current = false;
      events.close();
      clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [reload]);
  const act = useCallback(
    async (action: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        const result = await productionAction(action);
        await reload();
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "처리 실패");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );
  return { data, error, busy, writes, activity, reload, act };
}
