import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { cancelUnrevealedByBuyer } from "@/services/reveal-cancel";

type Ctx = { params: Promise<{ id: string }> };

/** 開示前の購入キャンセル（返金・在庫戻し。評価ペナルティなし） */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const result = await cancelUnrevealedByBuyer(user.id, id);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
