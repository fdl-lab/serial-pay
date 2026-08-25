import { jsonOk, jsonError } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { getAdminTradeStats } from "@/services/admin";

export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const stats = await getAdminTradeStats();
    return jsonOk({ stats });
  } catch (e) {
    return jsonError(e);
  }
}
