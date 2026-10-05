import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod/v4";
import { postSchema } from "../domain/schema";
import { CollectionBlocked, type Collector } from "../collection/types";
import { researchRuntimeDirectory } from "../runtime";

const responseSchema = z.union([
  z.object({ ok: z.literal(true), posts: z.array(postSchema), hasMore: z.boolean() }),
  z.object({ ok: z.literal(false), reason: z.enum(["login_required", "rate_limited", "access_denied", "not_found", "source_error"]), errorType: z.string() }),
]);

export const collectInstagram: Collector = async (request, context) => {
  if (request.cursor) throw new CollectionBlocked("unsupported", "Instagram anonymous account continuation is not supported.");
  const executable = process.env.CONTENT_STUDIO_RESEARCH_PYTHON ?? join(researchRuntimeDirectory(), "python", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  try { await access(executable); } catch {
    throw new CollectionBlocked("setup_required", "Run pnpm setup:research to install the isolated Instagram collector.");
  }
  const raw = await new Promise<string>((resolve, reject) => {
    // Installed runtime executables are deliberately not bundled by Next.
    const child = spawn(/* turbopackIgnore: true */ executable, [join(process.cwd(), "workers/instagram/collector.py")], { stdio: ["pipe", "pipe", "pipe"], shell: false });
    let output = "", settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true; clearTimeout(timer); context.signal.removeEventListener("abort", cancel);
      if (error) { child.kill(); reject(error); } else resolve(output);
    };
    const cancel = () => finish(new CollectionBlocked("source_error", "The collection was cancelled."));
    const timer = setTimeout(() => finish(new CollectionBlocked("timeout", "The Instagram collector timed out.")), 45_000);
    timer.unref();
    child.stdout.on("data", chunk => {
      output += chunk.toString();
      if (output.length > 2_000_000) finish(new CollectionBlocked("source_error", "The collector response exceeded its size limit."));
    });
    // Consume logs, but never return third-party diagnostic strings or headers.
    child.stderr.resume();
    child.stdin.once("error", () => finish(new CollectionBlocked("source_error", "The Python collector stopped before accepting its request.")));
    child.once("error", () => finish(new CollectionBlocked("setup_required", "The Python collector could not start.")));
    child.once("close", code => finish(code === 0 ? undefined : new CollectionBlocked("source_error", "The Python collector exited unsuccessfully.")));
    context.signal.addEventListener("abort", cancel, { once: true });
    if (context.signal.aborted) cancel();
    else child.stdin.end(JSON.stringify({ kind: request.kind, id: request.source.id, limit: request.limit }));
  });
  let response: z.infer<typeof responseSchema>;
  try { response = responseSchema.parse(JSON.parse(raw)); } catch {
    throw new CollectionBlocked("source_error", "The Instagram collector returned an invalid metadata response.");
  }
  if (!response.ok) throw new CollectionBlocked(response.reason, `Anonymous Instagram collection failed (${response.errorType}). No CAPTCHA was confirmed.`);
  return { posts: response.posts, nextCursor: null,
    warnings: response.hasMore ? ["This is a bounded account sample; anonymous continuation is not supported."] : [] };
};
