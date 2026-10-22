"use client";
import { useProduction } from "./hooks/use-production";
import { ProductionWorkspace } from "./components/production-workspace";
import { fetchWork } from "@/domains/content-production/client";
import { ResearchAccounts } from "@/screens/dashboard/components/settings/research-accounts";
import { useResearchAccounts } from "@/screens/dashboard/components/settings/use-research-accounts";

export function ContentProductionScreen({ onOpen }: { onOpen: (id: string) => Promise<void> }) {
  const runtime = useProduction();
  const accounts = useResearchAccounts();
  return <ProductionWorkspace runtime={runtime} readWork={fetchWork} settings={<ResearchAccounts state={accounts} />} onOpen={onOpen} />;
}
