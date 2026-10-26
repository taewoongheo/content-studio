import { connectorPath } from "../../../model/layout";
import { BaseEdge, type EdgeProps } from "@xyflow/react";

// The shared trunk is drawn once. Individual branches only draw their own row.
export function BranchTrunk({ id, style, sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const junctionX = (sourceX + targetX) / 2;
  return <BaseEdge id={id} style={style} path={`M ${sourceX} ${sourceY} H ${junctionX} V ${targetY}`} />;
}

export function BranchEdge({ id, style, markerEnd, sourceX, targetX, targetY }: EdgeProps) {
  const junctionX = (sourceX + targetX) / 2;
  return <BaseEdge id={id} style={style} markerEnd={markerEnd} path={`M ${junctionX} ${targetY} H ${targetX}`} />;
}


export function AdaptiveEdge({ id, style, markerEnd, sourceX, sourceY, targetX, targetY }: EdgeProps) {
  return <BaseEdge id={id} style={style} markerEnd={markerEnd} path={connectorPath(sourceX, sourceY, targetX, targetY)} />;
}
