import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { accountUrls, type AccountPlatform } from "../types";
import { SafariImportError } from "./errors";
const run = promisify(execFile);
export async function openSafariLogin(platform: AccountPlatform) {
  if (process.platform !== "darwin") throw new SafariImportError("unsupported");
  try { await run("/usr/bin/open", ["-b", "com.apple.Safari", accountUrls[platform]], { timeout: 5000 }); }
  catch { throw new SafariImportError("launch_failed"); }
}
