import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { markMessageRead } from "@/services/messages";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    await markMessageRead(user.id, id);
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
