export type CodexConnection = {
  status:
    "disconnected" | "connecting" | "connected" | "login-required" | "error";
  message: string;
};

export type CodexJsonValue =
  | null
  | boolean
  | number
  | string
  | CodexJsonValue[]
  | { [key: string]: CodexJsonValue };

type ImageDetail = "auto" | "low" | "high" | "original";

export type CodexUserInput =
  | { type: "text"; text: string }
  | { type: "image"; url: string; detail?: ImageDetail }
  | { type: "localImage"; path: string; detail?: ImageDetail };

export type CodexNotification = {
  method: string;
  params: unknown;
  threadId?: string;
  turnId?: string;
};

export type StructuredTurnResult =
  | {
      status: "completed";
      threadId: string;
      turnId: string;
      output: CodexJsonValue;
    }
  | {
      status: "failed" | "interrupted" | "invalid-output" | "timed-out";
      threadId: string;
      turnId: string;
      message: string;
    };
