import { ZodError } from "zod";

/** Transport-independent failures that callers can correct without parsing messages. */
export class OperationError extends Error {
  constructor(readonly code: string, message: string, readonly details: Record<string, unknown> = {},
    readonly recovery: "correct_input" | "read_latest" | "open_project" | "retry_later" | "inspect" = "correct_input") {
    super(message);
    this.name = "OperationError";
  }
}

export function commandFailure(index: number, command: { type: string }, cause: unknown) {
  const target = Object.fromEntries(Object.entries(command).filter(([key]) =>
    ["slideId", "placementId", "elementId", "layerId", "sourceSlideId", "sourcePlacementId"].includes(key)));
  return new OperationError("COMMAND_FAILED", `commands[${index}] (${command.type}): ${cause instanceof Error ? cause.message : "편집 실패"}`,
    { commandIndex: index, commandType: command.type, target,
      ...(cause instanceof OperationError ? { cause: { code: cause.code, details: cause.details } }
        : cause instanceof ZodError ? { issues: cause.issues } : {}) });
}
