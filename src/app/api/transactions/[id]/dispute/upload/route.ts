import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  RECORDING_MAX_DURATION_SEC,
  uploadDisputeRecording,
} from "@/lib/storage/recording";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id: transactionId } = await ctx.params;

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx || tx.buyerId !== user.id) {
      throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
    }
    if (tx.status !== "CONFIRMATION_WINDOW") {
      throw new ApiError(409, "異議申し立てできる期間ではありません", "INVALID_STATE");
    }
    if (tx.buyerConfirmedAt) {
      throw new ApiError(409, "受取確認済みのため異議は出せません", "ALREADY_CONFIRMED");
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "動画ファイルを添付してください", "FILE_REQUIRED");
    }

    const durationRaw = form.get("durationSec");
    const durationSec =
      typeof durationRaw === "string" ? Number(durationRaw) : NaN;
    if (!Number.isFinite(durationSec) || durationSec < 5) {
      throw new ApiError(400, "動画の長さを確認できませんでした", "DURATION_REQUIRED");
    }
    if (durationSec > RECORDING_MAX_DURATION_SEC) {
      throw new ApiError(
        400,
        "必要箇所を3分以内に切り取ってからアップロードしてください（編集・AI加工は不可）",
        "DURATION_TOO_LONG",
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "video/mp4";
    const uploaded = await uploadDisputeRecording({
      buyerId: user.id,
      transactionId,
      buffer,
      contentType,
    });

    return jsonOk({
      ...uploaded,
      recordingDurationSec: Math.round(durationSec),
      maxDurationSec: RECORDING_MAX_DURATION_SEC,
    });
  } catch (e) {
    return jsonError(e);
  }
}
