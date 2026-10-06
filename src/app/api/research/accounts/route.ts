import { researchAccounts } from "@/lib/research/accounts/service";
import { accountHandlers } from "@/lib/research/accounts/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { GET, POST } = accountHandlers(researchAccounts);
