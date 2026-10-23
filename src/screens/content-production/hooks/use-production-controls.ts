import { useState } from "react";
import type { WorkItem } from "@/domains/content-production/domain/contracts";
import { getTaskRemoval, type TaskActionHandler } from "../model/task-controls";
import type { useProduction } from "./use-production";

export function useProductionControls({ data, act, busy }: Pick<ReturnType<typeof useProduction>, "data" | "act" | "busy">) {
  const [stopping, setStopping] = useState(false);
  const dispatch = (action: Record<string, unknown>) => { void act(action).catch(() => {}); };
  const activeTasks = data?.tasks.filter(task => task.state === "running" || task.state === "pending") ?? [];

  const removeTask = (task: WorkItem) => {
    const { action, message } = getTaskRemoval(task);
    if (window.confirm(message)) dispatch({ action, id: task.id });
  };
  const taskAction: TaskActionHandler = (id, action, step) => {
    if (action === "delete_post") {
      const task = data?.tasks.find(task => task.id === id);
      if (task) removeTask(task);
      return;
    }
    dispatch({ action, id, ...(step ? { step } : {}) });
  };
  const stopAll = async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await Promise.allSettled(activeTasks.map(task => act({ action: "stop", id: task.id })));
    } finally {
      setStopping(false);
    }
  };
  return { dispatch, taskAction, removeTask, stopAll, controlsBusy: busy || stopping, stopDisabled: stopping || busy || !activeTasks.length };
}
