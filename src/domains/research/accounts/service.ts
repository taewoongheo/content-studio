import { AccountManager } from "@/domains/research/accounts/manager";
const services = globalThis as typeof globalThis & { contentStudioResearchAccounts?: AccountManager };
export const researchAccounts = services.contentStudioResearchAccounts ??= new AccountManager();
