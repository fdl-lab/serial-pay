import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { revealCodesForBuyer } from "@/services/checkout";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const result = await revealCodesForBuyer(user.id, id);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
