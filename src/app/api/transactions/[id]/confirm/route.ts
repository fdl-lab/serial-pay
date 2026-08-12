import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { confirmReceipt } from "@/services/complete";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const result = await confirmReceipt(user.id, id);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
