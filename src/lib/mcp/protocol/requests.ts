import { createHash } from "node:crypto";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { OperationError } from "@/lib/errors/operation";
import { guarded } from "./result";

export const requestIdSchema = z.string().trim().min(1).max(128).optional().describe(
  "Optional unique request ID. Reuse with identical arguments to replay the first outcome without executing again, including across MCP connections. Tool-scoped, retained for one hour after completion; server restart clears receipts. A changed request requires a new ID. Failed outcomes are replayed too.");

type Receipt = { fingerprint: string; promise: Promise<string>; expiresAt?: number; bytes: number };
function fingerprint(input: unknown) {
  const canonical = JSON.stringify(input, (_, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value);
  return createHash("sha256").update(canonical).digest("hex");
}

/** Bound admission by entry count and completed bytes; pending results may exceed the byte threshold. Never evict live guarantees. */
export class RequestReceipts {
  private entries = new Map<string, Receipt>();
  private bytes = 0;
  constructor(private readonly options: { now?: () => number; retentionMs?: number; maxEntries?: number; maxBytes?: number } = {}) {}
  async run(tool: string, input: Record<string, unknown>, operation: () => CallToolResult | Promise<CallToolResult>): Promise<CallToolResult> {
    const { requestId: rawId, ...argumentsWithoutId } = input;
    if (rawId === undefined) return guarded(operation);
    const requestId = requestIdSchema.parse(rawId)!;
    const now = this.options.now ?? Date.now;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt !== undefined && entry.expiresAt <= now()) {
        this.entries.delete(key); this.bytes -= entry.bytes;
      }
    }
    const key = `${tool}\0${requestId}`, hash = fingerprint(argumentsWithoutId);
    const existing = this.entries.get(key);
    if (existing) {
      if (existing.fingerprint !== hash) throw new OperationError("REQUEST_ID_REUSED", "같은 requestId에는 동일한 요청을 전달해 주세요. 변경한 요청에는 새 ID가 필요합니다.", { tool, requestId });
      return JSON.parse(await existing.promise) as CallToolResult;
    }
    if (this.entries.size >= (this.options.maxEntries ?? 256) || this.bytes >= (this.options.maxBytes ?? 32 * 1024 * 1024))
      throw new OperationError("REQUEST_CACHE_FULL", "중복 방지 기록의 보관 한도에 도달했습니다. 기록이 만료된 뒤 같은 requestId로 다시 시도해 주세요.",
        { maxEntries: this.options.maxEntries ?? 256, retentionMs: this.options.retentionMs ?? 3_600_000 }, "retry_later");
    const entry: Receipt = { fingerprint: hash, bytes: 0, promise: Promise.resolve("") };
    this.entries.set(key, entry);
    entry.promise = guarded(operation).then(result => {
      const serialized = JSON.stringify(result);
      entry.expiresAt = now() + (this.options.retentionMs ?? 3_600_000);
      entry.bytes = Buffer.byteLength(serialized); this.bytes += entry.bytes;
      return serialized;
    });
    return JSON.parse(await entry.promise) as CallToolResult;
  }
}

const state = globalThis as typeof globalThis & { studioRequestReceipts?: RequestReceipts };
export const requestReceipts = state.studioRequestReceipts ??= new RequestReceipts();
