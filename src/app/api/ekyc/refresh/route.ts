import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { refreshEkycFromStripe } from "@/services/ekyc";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const result = await refreshEkycFromStripe(user.id);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
