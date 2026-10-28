import { useEffect, useState } from "react";
import { emptyProduct, type Product, type ProductInput } from "@/domains/content-production/domain/product";

function inputValues(product: Product): ProductInput {
  return Object.fromEntries(Object.keys(emptyProduct).map(key => [key, product[key as keyof ProductInput]])) as ProductInput;
}

export function useProducts() {
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState<ProductInput>({ ...emptyProduct });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/products", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "제품을 불러오지 못했습니다.");
      if (!controller.signal.aborted) {
        const products = data.products as Product[];
        const product = products.find(product => product.active) ?? products[0] ?? null;
        setEditing(product);
        setDraft(product ? inputValues(product) : { ...emptyProduct });
        setReady(true);
      }
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "불러오기 실패"); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save() {
    if (busy || !ready) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", product: draft, ...(editing ? { id: editing.id, revision: editing.revision } : {}) }) });
      const next = await response.json();
      if (!response.ok) throw new Error(next.error || "요청 실패");
      const product = (next.products as Product[]).find(product => product.id === next.id);
      if (!product) throw new Error("저장된 제품을 확인하지 못했습니다.");
      setEditing(product);
      setDraft(inputValues(product));
      setDirty(false);
      setMessage("저장했습니다.");
    } catch (error) { setError(error instanceof Error ? error.message : "요청 실패"); }
    finally { setBusy(false); }
  }
  return { draft, busy, ready, error, message, dirty, save,
    update: (key: keyof ProductInput, value: string) => { setDraft(current => ({ ...current, [key]: value })); setDirty(true); setMessage(""); } };
}
