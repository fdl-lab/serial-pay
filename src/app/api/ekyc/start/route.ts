import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { startStripeIdentityEkyc } from "@/services/ekyc";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const result = await startStripeIdentityEkyc(user.id);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
