"use client";
import { useProduction } from "./hooks/use-production";
import { ProductionWorkspace } from "./components/production-workspace";
import { fetchWork } from "@/domains/content-production/client";

export function ContentProductionScreen({ onOpen }: { onOpen: (id: string) => Promise<void> }) {
  const runtime = useProduction();
  return <ProductionWorkspace runtime={runtime} readWork={fetchWork} onOpen={onOpen} />;
}
