import { jsonOk, jsonError } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import {
  findUserForAdminMessage,
  sendAdminMessage,
} from "@/services/messages";
import { ApiError } from "@/lib/api";

export async function POST(req: Request) {
  try {
    assertAdmin(req);
    const body = (await req.json().catch(() => ({}))) as {
      to?: string;
      title?: string;
      body?: string;
      linkHref?: string;
      linkLabel?: string;
    };

    const to = body.to?.trim() ?? "";
    const title = body.title?.trim() ?? "";
    const messageBody = body.body?.trim() ?? "";
    if (!to) throw new ApiError(400, "宛先を入力してください", "BAD_REQUEST");
    if (!title) throw new ApiError(400, "件名を入力してください", "BAD_REQUEST");
    if (!messageBody) {
      throw new ApiError(400, "本文を入力してください", "BAD_REQUEST");
    }

    const user = await findUserForAdminMessage(to);
    if (!user) {
      throw new ApiError(404, "ユーザーが見つかりません", "NOT_FOUND");
    }

    const msg = await sendAdminMessage({
      userId: user.id,
      title,
      body: messageBody,
      linkHref: body.linkHref?.trim() || null,
      linkLabel: body.linkLabel?.trim() || null,
    });

    return jsonOk({
      messageId: msg.id,
      user: {
        id: user.id,
        publicId: user.publicId,
        displayName: user.displayName,
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
