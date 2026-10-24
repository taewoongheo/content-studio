export type ToolAttempt = {
  call_id: string;
  tool: string;
  input: Record<string, unknown>;
  started_at: string;
  finished_at?: string;
  status: "pending" | "failed" | "succeeded" | "empty";
  output?: { count: number; ids: string[]; project_ids: string[] };
  code?: string;
  message?: string;
};
export type ProductionFailure = {
  code: string;
  message: string;
  step: string;
  phase: string;
  details: Record<string, unknown>;
  tool_calls: ToolAttempt[];
};
