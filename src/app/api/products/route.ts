import { z } from "zod";
import { isLocalRequest } from "@/lib/http/local-request";
import { getLocalDatabase } from "@/lib/local-db/database";
import { productSchema } from "@/domains/content-production/domain/product";
import { deleteProduct, listProducts, saveProduct, selectProduct } from "@/domains/content-production/server/products/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), product: productSchema, id: z.string().min(1).optional(), revision: z.number().int().positive().optional() }).strict(),
  z.object({ action: z.literal("select"), id: z.string().min(1) }).strict(),
  z.object({ action: z.literal("delete"), id: z.string().min(1), revision: z.number().int().positive() }).strict(),
]);
export async function GET(request: Request) {
  if (!isLocalRequest(request)) return new Response(null, { status: 403 });
  return Response.json({ products: listProducts(getLocalDatabase()) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!isLocalRequest(request, true)) return new Response(null, { status: 403 });
  try {
    const input = schema.parse(await request.json()), db = getLocalDatabase();
    let id: string | undefined;
    if (input.action === "save") id = db.transaction(() => {
      const savedId = saveProduct(db, input.product, input.id, input.revision);
      selectProduct(db, savedId);
      return savedId;
    })();
    else if (input.action === "select") selectProduct(db, input.id);
    else deleteProduct(db, input.id, input.revision);
    return Response.json({ products: listProducts(db), id });
  } catch (error) {
    return Response.json({ error: error instanceof z.ZodError ? "제품명과 링크 형식 등 입력 항목을 확인해 주세요." : error instanceof Error ? error.message : "제품 요청 실패" }, { status: 400 });
  }
}
