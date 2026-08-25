import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { uploadDisputeRecordingPart } from "@/lib/storage/recording";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id: transactionId } = await ctx.params;

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { buyerId: true },
    });
    if (!tx || tx.buyerId !== user.id) {
      throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch (e) {
      console.error("dispute upload-part formData failed", e);
      throw new ApiError(
        413,
        "動画の分割データが大きすぎます。もう少し短い動画にしてください",
        "BODY_TOO_LARGE",
      );
    }
    const key = String(form.get("key") ?? "");
    const uploadId = String(form.get("uploadId") ?? "");
    const mode = String(form.get("mode") ?? "s3") === "local" ? "local" : "s3";
    const partNumber = Number(form.get("partNumber"));
    const chunk = form.get("chunk");

    if (!key.startsWith(`disputes/${user.id}/${transactionId}/`)) {
      throw new ApiError(403, "不正なアップロード先です", "BAD_KEY");
    }
    if (typeof chunk === "string" || chunk == null || typeof chunk.arrayBuffer !== "function") {
      throw new ApiError(400, "分割データがありません", "CHUNK_REQUIRED");
    }
    if (!Number.isFinite(partNumber) || partNumber < 1) {
      throw new ApiError(400, "不正な分割番号です", "BAD_PART");
    }

    const buffer = Buffer.from(await chunk.arrayBuffer());
    const result = await uploadDisputeRecordingPart({
      key,
      uploadId,
      partNumber,
      buffer,
      mode,
    });

    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
