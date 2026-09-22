type CodexCommand = {
  command: string;
  args: string[];
};

type CodexEnvironment = {
  CODEX_BIN?: string;
  ComSpec?: string;
};

export function getCodexCommand(
  platform: NodeJS.Platform = process.platform,
  env: CodexEnvironment = {
    CODEX_BIN: process.env.CODEX_BIN,
    ComSpec: process.env.ComSpec,
  },
): CodexCommand {
  if (env.CODEX_BIN) {
    return { command: env.CODEX_BIN, args: ["app-server"] };
  }

  if (platform === "win32") {
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", "codex.cmd app-server"],
    };
  }

  return { command: "codex", args: ["app-server"] };
}
