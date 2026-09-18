export type CodexConnection = {
  status:
    "disconnected" | "connecting" | "connected" | "login-required" | "error";
  message: string;
};
