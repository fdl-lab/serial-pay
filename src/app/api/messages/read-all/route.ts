import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { markAllMessagesRead } from "@/services/messages";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    await markAllMessagesRead(user.id);
    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
