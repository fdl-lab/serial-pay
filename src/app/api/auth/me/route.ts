import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { toVerificationStatus } from "@/services/auth";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    return jsonOk({ user: toVerificationStatus(user) });
  } catch (e) {
    return jsonError(e);
  }
}
