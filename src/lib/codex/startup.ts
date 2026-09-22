import { codexConnection } from "./connection";

export function startCodexConnection() {
  // Start in the background so Codex availability doesn't block the web UI.
  void codexConnection.connect().catch(() => {
    console.warn(
      "Codex 자동 연결에 실패했습니다. 사이드바에서 다시 연결하세요.",
    );
  });
}
