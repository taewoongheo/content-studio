type Size = { width: number; height: number };
type PositionedNode = { id: string; position: { x: number; y: number } };
const COLUMN_GAP = 80;
const ROW_GAP = 64;

// Use the graph's logical rows/columns, never the previous measured layout.
export function layoutNodes<T extends PositionedNode>(nodes: T[], measurements: Record<string, Size>): T[] {
  const columns = [...new Set(nodes.map(node => node.position.x))].sort((a, b) => a - b);
  const rows = [...new Set(nodes.map(node => node.position.y))].sort((a, b) => a - b);
  const positions = (keys: number[], axis: "x" | "y", dimension: keyof Size, fallback: number, gap: number) => {
    let offset = 0;
    return new Map(keys.map(key => {
      const position = offset;
      const sizes = nodes.filter(node => node.position[axis] === key)
        .map(node => measurements[node.id]?.[dimension] ?? fallback);
      offset += Math.max(...sizes) + gap;
      return [key, position];
    }));
  };
  const x = positions(columns, "x", "width", 300, COLUMN_GAP);
  const y = positions(rows, "y", "height", 340, ROW_GAP);
  return nodes.map(node => ({ ...node, position: { x: x.get(node.position.x)!, y: y.get(node.position.y)! } }));
}

export function connectorPath(sourceX: number, sourceY: number, targetX: number, targetY: number) {
  if (Math.abs(sourceY - targetY) < 0.5) return `M ${sourceX} ${sourceY} H ${targetX}`;
  return `M ${sourceX} ${sourceY} H ${(sourceX + targetX) / 2} V ${targetY} H ${targetX}`;
}
