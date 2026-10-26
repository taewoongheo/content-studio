"use client";
import { useEffect, useState } from "react";
import type { WorkDetail, WorkItem } from "@/domains/content-production/domain/contracts";

export function useNodeDetails(tasks: WorkItem[] | undefined, readWork: (id: string) => Promise<WorkDetail>) {
  const [details, setDetails] = useState<Record<string, WorkDetail>>({});
  const key = tasks?.map(task => `${task.id}:${task.updated_at}:${task.current_step}:${task.state}`).join("|") ?? "";
  useEffect(() => {
    let active = true;
    const ids = key ? key.split("|").map(entry => entry.split(":")[0]) : [];
    void Promise.all(ids.map(async id => {
      try { return [id, await readWork(id)] as const; }
      catch { return null; }
    })).then(rows => {
      if (active) setDetails(Object.fromEntries(rows.filter(row => row !== null)));
    });
    return () => { active = false; };
  }, [key, readWork]);
  return details;
}
