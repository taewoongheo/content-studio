import Ajv from "ajv";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OperationError } from "@/lib/errors/operation";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function runCodex(input: {
  model?: string;
  capabilities?: {webSearch: boolean; shell: boolean};
  prompt: string;
  images?: string[];
  schema: unknown;
  origin: string;
  taskId: string;
  token: string;
  signal: AbortSignal;
  onActivity: (message: string) => void;
  displayOnly?: boolean;
  onToolActivity?: (event: {callId:string;name:string;input:unknown;result?:CallToolResult}) => void;
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
    ).catch(() => { throw new OperationError("CLI_SETUP_FAILED", "CLI 실행 전 MCP 설정 조회에 실패했습니다. Codex 실행 경로와 설정을 확인해 주세요."); });
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
          !input.displayOnly && input.capabilities?.webSearch ? 'web_search="live"' : 'web_search="disabled"',
          ...(!input.capabilities?.shell || input.displayOnly ? ["-c", "features.shell_tool=false", "-c", "features.unified_exec=false"] : []),
          ...(input.displayOnly ? ["--skip-git-repo-check", "-c", 'model_reasoning_effort="low"'] : []),
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
            if (event.item?.type === "mcp_tool_call" && ["item.started", "item.completed"].includes(event.type)) {
              const item = event.item;
              input.onToolActivity?.({ callId: `cli:${item.id}`, name: item.tool, input: item.arguments,
                ...(event.type === "item.completed" ? { result: item.result ? {
                  ...item.result,
                  content: Array.isArray(item.result.content) ? item.result.content : [],
                  structuredContent: item.result.structuredContent ?? item.result.structured_content,
                  isError: item.status === "failed" || item.result.isError === true || item.result.is_error === true,
                } : {
                  isError: true, content: [], structuredContent: { error: { code: "MCP_CALL_NO_RESPONSE", message: item.error?.message ?? "MCP call finished without a response." } },
                } } : {}) });
            }
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
            new OperationError("CLI_PROCESS_FAILED",
              `Codex 실행 실패 (${code}): ${input.token ? (protocolError || errorTail).replaceAll(input.token, "[redacted]") : protocolError || errorTail}`,
            ),
          );
      });
      child.stdin.on("error", () => {});
      child.stdin.end(input.prompt);
      if (input.signal.aborted) abort();
    });
    const raw = await readFile(output, "utf8").catch(() => {
      throw new OperationError("CLI_OUTPUT_MISSING", "CLI가 최종 응답 파일을 생성하지 않았습니다.");
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("Expected an object");
    } catch {
      throw new OperationError("CLI_OUTPUT_INVALID_JSON", "CLI 최종 응답이 JSON 객체 형식이 아닙니다. 저장된 draft에서 다시 실행해 주세요.");
    }
    const validate = new Ajv({ strict: false, allErrors: true }).compile(input.schema as object);
    if (!validate(parsed)) throw new OperationError("OUTPUT_SCHEMA_INVALID", "CLI 최종 응답이 출력 스키마와 맞지 않습니다.", { issues: validate.errors });
    return parsed as Record<string, unknown>;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
