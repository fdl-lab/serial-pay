import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { softDeleteListingComment } from "@/services/listing-comments";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const result = await softDeleteListingComment(user, id);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
