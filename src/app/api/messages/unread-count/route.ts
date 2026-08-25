import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { countUnreadMessages } from "@/services/messages";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const unreadCount = await countUnreadMessages(user.id);
    return jsonOk({ unreadCount });
  } catch (e) {
    return jsonError(e);
  }
}
