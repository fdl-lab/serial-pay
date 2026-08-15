import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { listSellerListings } from "@/services/listing";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const items = await listSellerListings(user.id);
    return jsonOk({ items });
  } catch (e) {
    return jsonError(e);
  }
}
