"use client";
import { useCallback, useEffect, useState } from "react";
import { advanceSimulation, emptySimulation, mockAction, startSimulation } from "./simulation";

export function usePreviewProduction() {
  const [model, setModel] = useState(emptySimulation);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [withFailure, setWithFailure] = useState(false);
  const active = model.data.sync.running || model.data.tasks.some(task => ["pending", "running"].includes(task.state));
  useEffect(() => {
    if (paused || !active) return;
    const timer = setInterval(() => setModel(advanceSimulation), 1000 / speed);
    return () => clearInterval(timer);
  }, [paused, speed, active]);
  const start = useCallback((count: number) => {
    setModel(previous => {
      const next = startSimulation(count, withFailure);
      next.data.settings = previous.data.settings;
      return next;
    });
    setPaused(false);
  }, [withFailure]);
  const act = useCallback(async (input: Record<string, unknown>) => {
    if (input.action === "start") start(Math.max(1, Number(input.count) || 1));
    else setModel(previous => mockAction(previous, input));
    return { mock: true };
  }, [start]);
  const readWork = useCallback(async (id: string) => {
    const detail = model.details[id];
    if (!detail) throw new Error("미리보기 작업이 초기화됐습니다.");
    return structuredClone(detail);
  }, [model.details]);
  const reload = useCallback(async () => {}, []);
  return {
    runtime: { data: model.data, error: null, busy: false, writes: model.writes, activity: model.activity, reload, act },
    readWork, paused, setPaused, speed, setSpeed, withFailure, setWithFailure,
    start, step: () => setModel(advanceSimulation), reset: () => { setModel(emptySimulation()); setPaused(false); },
  };
}
