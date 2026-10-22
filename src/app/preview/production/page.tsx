import { notFound } from "next/navigation";
import { ProductionPreviewScreen } from "@/screens/content-production/preview/production-preview-screen";

export default function ProductionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ProductionPreviewScreen />;
}
