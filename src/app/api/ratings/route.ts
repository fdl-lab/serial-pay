import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { listPendingBuyerRatings } from "@/services/rating";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const pending = await listPendingBuyerRatings(user.id);
    return jsonOk({ pending });
  } catch (e) {
    return jsonError(e);
  }
}
