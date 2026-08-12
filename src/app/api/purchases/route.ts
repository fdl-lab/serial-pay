import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { listBuyerPurchases } from "@/services/checkout";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const purchases = await listBuyerPurchases(user.id);
    return jsonOk({ purchases });
  } catch (e) {
    return jsonError(e);
  }
}
