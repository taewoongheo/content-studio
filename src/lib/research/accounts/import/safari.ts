import * as z from "zod/v4";
import { PythonWorkerError, runPythonWorker } from "../../process/python";
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
  let raw: string;
  try { raw = await runPythonWorker({ script: "workers/accounts/safari.py", args: [platform], timeoutMs: 15_000 }); }
  catch (error) {
    throw new SafariImportError(error instanceof PythonWorkerError && error.reason === "setup_required" ? "setup_required" : "source_error");
  }
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
