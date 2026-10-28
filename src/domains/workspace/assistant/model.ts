export type AssistantTarget = { projectId: string; tabId: string; projectType: "slideshow" | "video" };
export type AssistantSelection = { slideIds?: string[]; placementIds?: string[]; layerIds?: string[]; frame?: number };
export type AssistantState = { state: "idle" | "running" | "completed" | "failed" | "stopped"; phase: string;
  requestId?: string; command?: string; text: string; suggestion: string; error: string; changed: boolean };
