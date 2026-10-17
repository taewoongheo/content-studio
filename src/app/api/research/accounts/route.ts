import { researchAccounts } from "@/domains/research/accounts/service";
import { accountHandlers } from "@/domains/research/accounts/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const { GET, POST } = accountHandlers(researchAccounts);
