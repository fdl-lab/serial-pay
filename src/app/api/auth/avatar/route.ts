import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { uploadAvatar } from "@/lib/storage/avatar";
import { getMeStatus } from "@/services/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "画像を選んでね", "FILE_REQUIRED");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadAvatar({
      userId: user.id,
      buffer,
      contentType: file.type || "image/jpeg",
    });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { avatarUrl: uploaded.url },
    });

    return jsonOk({
      url: uploaded.url,
      key: uploaded.key,
      user: await getMeStatus(updated),
    });
  } catch (e) {
    return jsonError(e);
  }
}
