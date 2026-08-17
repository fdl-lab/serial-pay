import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { getMeDashboard } from "@/services/me-dashboard";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const dashboard = await getMeDashboard(user);
    return jsonOk(dashboard);
  } catch (e) {
    return jsonError(e);
  }
}
