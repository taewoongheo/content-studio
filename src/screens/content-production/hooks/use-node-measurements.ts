import { useCallback, useState } from "react";
import type { OnNodesChange } from "@xyflow/react";
import type { WorkflowNode } from "../components/workflow/graph";

// Retain controlled-node dimensions across content updates so React Flow keeps nodes visible.
export function useNodeMeasurements() {
  const [measurements, setMeasurements] = useState<Record<string, { width: number; height: number }>>({});
  const onNodesChange = useCallback<OnNodesChange<WorkflowNode>>(changes => {
    setMeasurements(previous => {
      let next = previous;
      for (const change of changes) {
        if (change.type !== "dimensions" || !change.dimensions) continue;
        const old = next[change.id], size = change.dimensions;
        if (old?.width === size.width && old?.height === size.height) continue;
        if (next === previous) next = { ...previous };
        next[change.id] = size;
      }
      return next;
    });
  }, []);
  return { measurements, onNodesChange };
}
