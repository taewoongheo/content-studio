import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function runCodex(input: {
  model?: string;
  prompt: string;
  images?: string[];
  schema: unknown;
  origin: string;
  taskId: string;
  token: string;
  signal: AbortSignal;
  onActivity: (message: string) => void;
  displayOnly?: boolean;
}) {
  const directory = await mkdtemp(join(tmpdir(), "content-production-")),
    schema = join(directory, "output-schema.json"),
    output = join(directory, "result.json");
  try {
    const executable = process.env.CONTENT_STUDIO_CODEX_BIN || "codex";
    const listed = await promisify(execFile)(
      executable,
      ["mcp", "list", "--json"],
      { maxBuffer: 2 * 1024 * 1024, signal: input.signal },
    );
    const servers = JSON.parse(listed.stdout) as Array<{
      name: string;
      enabled: boolean;
      transport: { url?: string; command?: string };
    }>;
    const disableServers = servers
      .filter((server) => server.enabled)
      .flatMap((server) => [
        "-c",
        `mcp_servers.${server.name}.${server.transport.url ? "url" : "command"}=${JSON.stringify(server.transport.url ?? server.transport.command)}`,
        "-c",
        `mcp_servers.${server.name}.enabled=false`,
      ]);
    await writeFile(schema, JSON.stringify(input.schema));
    input.signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.env.CONTENT_STUDIO_CODEX_BIN || "codex",
        [
          "exec",
          ...(input.model ? ["--model", input.model] : []),
          ...(!input.displayOnly ? (input.images ?? []).flatMap(path => ["--image", path]) : []),
          "--json",
          "--ephemeral",
          "-c",
          input.displayOnly ? 'web_search="disabled"' : 'web_search="live"',
          ...(input.displayOnly ? ["--skip-git-repo-check", "-c", "features.shell_tool=false", "-c", "features.unified_exec=false", "-c", 'model_reasoning_effort="low"'] : []),
          "--sandbox",
          "read-only",
          "--output-schema",
          schema,
          "--output-last-message",
          output,
          ...disableServers,
          ...(!input.displayOnly ? [
            "-c", `mcp_servers.production.url=${JSON.stringify(`${input.origin}/api/content-production/agent/${input.taskId}`)}`,
            "-c", 'mcp_servers.production.bearer_token_env_var="CONTENT_PRODUCTION_RUN_TOKEN"',
            "-c", "mcp_servers.production.enabled=true",
          ] : []),
          "-",
        ],
        {
          cwd: input.displayOnly ? directory : process.cwd(),
          env: { ...process.env, CONTENT_PRODUCTION_RUN_TOKEN: input.token },
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
          detached: process.platform !== "win32",
        },
      );
      let tail = "",
        errorTail = "",
        protocolError = "";
      const kill = () => {
        try {
          if (child.pid && process.platform !== "win32")
            process.kill(-child.pid, "SIGTERM");
          else child.kill("SIGTERM");
        } catch {}
      };
      let force: ReturnType<typeof setTimeout> | undefined;
      const abort = () => {
        kill();
        force = setTimeout(() => {
          try {
            if (child.pid && process.platform !== "win32")
              process.kill(-child.pid, "SIGKILL");
            else child.kill("SIGKILL");
          } catch {}
        }, 2000);
      };
      input.signal.addEventListener("abort", abort, { once: true });
      child.stdout.on("data", (chunk) => {
        tail += String(chunk);
        const lines = tail.split("\n");
        tail = lines.pop()!.slice(-65536);
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            if (event.type === "error" || event.type === "turn.failed")
              protocolError = JSON.stringify(event).slice(-4000);
            if (
              event.type === "item.started" ||
              event.type === "item.completed"
            )
              input.onActivity(event.item?.type ?? "작업 진행");
          } catch {}
        }
      });
      child.stderr.on("data", (chunk) => {
        errorTail = (errorTail + String(chunk)).slice(-3000);
      });
      const finish = () => {
        input.signal.removeEventListener("abort", abort);
        clearTimeout(force);
      };
      child.once("error", (error) => {
        finish();
        reject(error);
      });
      child.once("close", (code) => {
        finish();
        if (input.signal.aborted) reject(input.signal.reason);
        else if (code === 0) resolve();
        else
          reject(
            new Error(
              `Codex 실행 실패 (${code}): ${input.token ? (protocolError || errorTail).replaceAll(input.token, "[redacted]") : protocolError || errorTail}`,
            ),
          );
      });
      child.stdin.on("error", () => {});
      child.stdin.end(input.prompt);
      if (input.signal.aborted) abort();
    });
    return JSON.parse(await readFile(output, "utf8")) as Record<
      string,
      unknown
    >;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
