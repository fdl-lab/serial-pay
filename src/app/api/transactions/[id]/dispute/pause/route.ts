import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { pauseConfirmationForDisputePage } from "@/services/dispute";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id: transactionId } = await ctx.params;
    const result = await pauseConfirmationForDisputePage(user.id, transactionId);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
