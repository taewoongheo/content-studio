import type { ElementDefinition, ElementKind } from "../types";

export function makeElementDefinition(input: {
  id: string;
  kind: Exclude<ElementKind, "background">;
  name?: string;
  role?: string;
}): ElementDefinition {
  const shapeNames = { rectangle: "사각형", circle: "원형", triangle: "삼각형" } as const;
  const isShape = input.kind === "rectangle" || input.kind === "circle" || input.kind === "triangle";
  return {
    id: input.id,
    name: input.name?.trim() || (isShape ? shapeNames[input.kind as keyof typeof shapeNames]
      : input.kind === "text" ? "새 텍스트" : "새 이미지"),
    role: input.role?.trim() || (isShape ? "이 장의 시각적 강조"
      : input.kind === "text" ? "이 장의 추가 설명" : "이 장의 시각 자료"),
    kind: input.kind,
    frame: isShape ? { x: 0.35, y: 0.35, width: 0.3, height: 0.2 }
      : { x: 0.15, y: 0.4, width: 0.7, height: 0.2 },
    style: { color: "#111111", backgroundColor: isShape ? "#111111" : "transparent",
      fontSize: 36, lineHeight: 1.2, fontWeight: 700, textAlign: "center", borderRadius: 0,
      borderEnabled: isShape, borderColor: "#111111", borderWidth: 2,
      fontFamily: input.kind === "text" ? "inter" : "sans-serif", imageFit: "cover" },
  };
}
