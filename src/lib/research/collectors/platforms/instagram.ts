import * as z from "zod/v4";
import { storedCookieSchema } from "../../accounts/storage/cookies";
import { postSchema } from "../../domain/schema";
import { CollectionBlocked, type Collector } from "../../collection/types";
import { PythonWorkerError, runPythonWorker } from "../../process/python";

const responseSchema = z.union([
  z.object({ ok: z.literal(true), posts: z.array(postSchema), hasMore: z.boolean(), cookies: z.array(storedCookieSchema).max(1000).optional() }),
  z.object({ ok: z.literal(false), reason: z.enum(["login_required", "rate_limited", "access_denied", "not_found", "source_error"]), errorType: z.string() }),
]);

export const collectInstagram: Collector = async (request, context) => {
  if (request.cursor) throw new CollectionBlocked("unsupported", "Instagram anonymous account continuation is not supported.");
  let raw: string;
  try {
    raw = await runPythonWorker({ script: "workers/instagram/collector.py", signal: context.signal, timeoutMs: 45_000,
      input: JSON.stringify({ kind: request.kind, id: request.source.id, limit: request.limit, cookies: context.authState?.cookies ?? [] }) });
  } catch (error) {
    if (error instanceof PythonWorkerError && error.reason === "setup_required")
      throw new CollectionBlocked("setup_required", "Run pnpm setup:research to install the isolated Instagram collector.");
    if (error instanceof PythonWorkerError && error.reason === "timeout")
      throw new CollectionBlocked("timeout", "The Instagram collector timed out.");
    throw new CollectionBlocked("source_error", "The Instagram collector stopped or returned too much data.");
  }
  let response: z.infer<typeof responseSchema>;
  try { response = responseSchema.parse(JSON.parse(raw)); } catch {
    throw new CollectionBlocked("source_error", "The Instagram collector returned an invalid metadata response.");
  }
  if (!response.ok) throw new CollectionBlocked(response.reason, `Instagram collection failed (${response.errorType}). No CAPTCHA was confirmed.`);
  if (response.cookies && context.authState) context.persistAuthState?.({ ...context.authState, cookies: response.cookies });
  return { posts: response.posts, nextCursor: null,
    warnings: response.hasMore ? ["This is a bounded account sample; anonymous continuation is not supported."] : [] };
};
