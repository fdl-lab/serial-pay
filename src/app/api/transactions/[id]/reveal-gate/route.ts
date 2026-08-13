import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { getRevealGateForBuyer } from "@/services/checkout";

type Ctx = { params: Promise<{ id: string }> };

/** 開示前の状態だけ返す（タイマーは開始しない） */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const result = await getRevealGateForBuyer(user.id, id);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
