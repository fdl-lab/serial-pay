import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { listUserMessages } from "@/services/messages";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const messages = await listUserMessages(user.id);
    const unreadCount = messages.filter((m) => m.unread).length;
    return jsonOk({ messages, unreadCount });
  } catch (e) {
    return jsonError(e);
  }
}
