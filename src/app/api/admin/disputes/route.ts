import { jsonOk, jsonError } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { listOpenDisputes } from "@/services/admin";

export async function GET(req: Request) {
  try {
    assertAdmin(req);
    const disputes = await listOpenDisputes();
    return jsonOk({ disputes, count: disputes.length });
  } catch (e) {
    return jsonError(e);
  }
}
