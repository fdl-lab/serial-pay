import { z } from "zod";
import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  RECORDING_MAX_DURATION_SEC,
  initDisputeRecordingUpload,
} from "@/lib/storage/recording";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  fileName: z.string().max(240).optional(),
  contentType: z.string().max(120).optional(),
  size: z.number().int().positive().max(100 * 1024 * 1024),
  durationSec: z.number().min(5).max(RECORDING_MAX_DURATION_SEC),
});

async function assertCanDispute(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!tx || tx.buyerId !== userId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }
  if (tx.status !== "CONFIRMATION_WINDOW") {
    throw new ApiError(
      409,
      "異議申し立てできる期間ではありません",
      "INVALID_STATE",
    );
  }
  if (tx.buyerConfirmedAt) {
    throw new ApiError(
      409,
      "受取確認済みのため異議は出せません",
      "ALREADY_CONFIRMED",
    );
  }
  return tx;
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id: transactionId } = await ctx.params;
    await assertCanDispute(user.id, transactionId);

    const input = bodySchema.parse(await req.json());
    const target = await initDisputeRecordingUpload({
      buyerId: user.id,
      transactionId,
      contentType: input.contentType ?? "video/mp4",
      fileName: input.fileName,
      size: input.size,
    });

    return jsonOk({
      ...target,
      recordingDurationSec: Math.round(input.durationSec),
      maxDurationSec: RECORDING_MAX_DURATION_SEC,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return jsonError(
        new ApiError(400, e.errors[0]?.message ?? "入力が不正です", "VALIDATION"),
      );
    }
    return jsonError(e);
  }
}
