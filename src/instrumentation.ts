export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCodexConnection } = await import("./lib/codex/startup");
    startCodexConnection();
  }
}
