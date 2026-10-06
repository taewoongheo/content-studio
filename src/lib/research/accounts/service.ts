import { AccountManager } from "./manager";
const services = globalThis as typeof globalThis & { contentStudioResearchAccounts?: AccountManager };
export const researchAccounts = services.contentStudioResearchAccounts ??= new AccountManager();
