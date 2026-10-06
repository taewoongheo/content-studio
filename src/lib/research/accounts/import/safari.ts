import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod/v4";
import { researchRuntimeDirectory } from "../../runtime";
import { loginCookie, platformState, storedCookieSchema, type AuthState } from "../storage/cookies";
import type { AccountPlatform } from "../types";
import { SafariImportError } from "./errors";

const responseSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), cookies: z.array(storedCookieSchema).max(1000) }),
  z.object({ ok: z.literal(false), reason: z.enum(["unsupported", "setup_required", "permission_required", "cookies_missing", "source_error"]) }),
]);

/** Credentials travel only through a private pipe to the local account store. */
export async function importSafariState(platform: AccountPlatform): Promise<AuthState> {
  if (process.platform !== "darwin") throw new SafariImportError("unsupported");
  const executable = process.env.CONTENT_STUDIO_RESEARCH_PYTHON ?? join(researchRuntimeDirectory(), "python/bin/python");
  try { await access(executable); } catch { throw new SafariImportError("setup_required"); }
  const raw = await new Promise<string>((resolve, reject) => {
    const child = spawn(/* turbopackIgnore: true */ executable, [join(process.cwd(), "workers/accounts/safari.py"), platform],
      { stdio: ["ignore", "pipe", "pipe"], shell: false });
    let output = "", settled = false;
    let killTimer: NodeJS.Timeout | undefined;
    const finish = (error?: SafariImportError) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) {
        child.kill(); killTimer = setTimeout(() => child.kill("SIGKILL"), 1000); killTimer.unref();
        reject(error);
      } else resolve(output);
    };
    const timer = setTimeout(() => finish(new SafariImportError("source_error")), 15_000); timer.unref();
    child.stdout.on("data", chunk => {
      if (settled) return;
      output += chunk.toString();
      if (output.length > 2_000_000) finish(new SafariImportError("source_error"));
    });
    child.stderr.resume(); // Never expose third-party diagnostics or credentials.
    child.once("error", () => finish(new SafariImportError("setup_required")));
    child.once("close", code => { clearTimeout(killTimer); finish(code === 0 ? undefined : new SafariImportError("source_error")); });
  });
  return parseSafariState(raw, platform);
}

export function parseSafariState(raw: string, platform: AccountPlatform): AuthState {
  let response: z.infer<typeof responseSchema>;
  try { response = responseSchema.parse(JSON.parse(raw)); } catch { throw new SafariImportError("source_error"); }
  if (!response.ok) throw new SafariImportError(response.reason);
  const state = platformState({ cookies: response.cookies, origins: [] }, platform);
  if (!loginCookie(state, platform)) throw new SafariImportError("cookies_missing");
  return state;
}
