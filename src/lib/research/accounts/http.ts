import * as z from "zod/v4";
import { isLocalRequest } from "@/lib/http/local-request";
import type { AccountManager } from "./manager";
import { accountPlatforms } from "./types";
import { SafariImportError } from "./import/errors";
const actionSchema = z.strictObject({ platform: z.enum(accountPlatforms), action: z.enum(["login", "finish", "cancel", "disconnect", "import_safari"]) });
export function accountHandlers(accounts: AccountManager) {
  return {
    GET(request: Request) {
      if (!isLocalRequest(request)) return new Response(null, { status: 403 });
      return Response.json({ accounts: accounts.list() }, { headers: { "Cache-Control": "no-store" } });
    },
    async POST(request: Request) {
      if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
      let input: z.infer<typeof actionSchema>;
      try {
        const body = await request.text(); if (body.length > 4096) throw new Error("size");
        input = actionSchema.parse(JSON.parse(body));
      } catch { return Response.json({ error: "계정 연결 요청을 확인해 주세요." }, { status: 400 }); }
      try {
        if (input.action === "login") await accounts.startLogin(input.platform);
        if (input.action === "finish") await accounts.finishLogin(input.platform);
        if (input.action === "cancel") await accounts.cancelLogin(input.platform);
        if (input.action === "disconnect") await accounts.disconnect(input.platform);
        if (input.action === "import_safari") await accounts.importSafari(input.platform);
        return Response.json({ accounts: accounts.list() }, { headers: { "Cache-Control": "no-store" } });
      } catch (error) {
        if (error instanceof SafariImportError) return Response.json({ error: error.message, reason: error.reason }, { status: 409 });
        return Response.json({ error: input.action === "finish" ? "Safari에서 로그인한 뒤 Safari를 종료하고 다시 시도해 주세요." :
          "계정 연결을 처리하지 못했습니다. 진행 중인 작업과 Safari 실행 상태를 확인해 주세요." }, { status: 409 });
      }
    },
  };
}
