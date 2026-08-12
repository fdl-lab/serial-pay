import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { ApiError } from "@/lib/api";
import { releasePayout } from "@/services/complete";

const disputeSchema = z.object({
  reason: z.enum([
    "CODE_INVALID",
    "CODE_ALREADY_USED",
    "WRONG_CODE",
    "OTHER",
  ]),
  description: z.string().max(5000).optional(),
  /** 画録のアップロード済み URL（未添付は自動却下） */
  screenRecordingUrl: z.string().url(),
  screenRecordingKey: z.string().optional(),
  recordingDurationSec: z.number().int().min(5).max(3600).optional(),
});

export async function createDispute(buyerId: string, transactionId: string, raw: unknown) {
  const input = disputeSchema.parse(raw);

  if (!input.screenRecordingUrl) {
    throw new ApiError(
      400,
      "画面録画の添付がない申請は自動却下されます",
      "RECORDING_REQUIRED",
    );
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!tx || tx.buyerId !== buyerId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }
  if (tx.status !== "CONFIRMATION_WINDOW") {
    throw new ApiError(409, "異議申し立てできる期間ではありません", "INVALID_STATE");
  }

  const now = new Date();
  const withinWindow =
    !!tx.confirmationDeadlineAt && tx.confirmationDeadlineAt >= now;

  if (!withinWindow) {
    throw new ApiError(
      400,
      "確認期限を過ぎたため異議申し立てできません",
      "DEADLINE_PASSED",
    );
  }

  const existing = await prisma.dispute.findUnique({
    where: { transactionId },
  });
  if (existing) {
    throw new ApiError(409, "既に異議申し立て済みです", "ALREADY_DISPUTED");
  }

  const dispute = await prisma.$transaction(async (db) => {
    const d = await db.dispute.create({
      data: {
        transactionId,
        filerId: buyerId,
        reason: input.reason,
        description: input.description,
        screenRecordingUrl: input.screenRecordingUrl,
        screenRecordingKey: input.screenRecordingKey,
        recordingDurationSec: input.recordingDurationSec,
        status: "SUBMITTED",
        filedWithinWindow: true,
      },
    });

    await db.transaction.update({
      where: { id: transactionId },
      data: { status: "DISPUTED" },
    });

    await db.serialCode.updateMany({
      where: { transactionId },
      data: { status: "DISPUTED" },
    });

    await db.user.update({
      where: { id: buyerId },
      data: { disputeCountAsBuyer: { increment: 1 } },
    });
    await db.user.update({
      where: { id: tx.sellerId },
      data: { disputeCountAsSeller: { increment: 1 } },
    });

    await db.auditLog.create({
      data: {
        actorUserId: buyerId,
        action: "DISPUTE_SUBMITTED",
        entityType: "Dispute",
        entityId: d.id,
        metadata: { reason: input.reason },
      },
    });

    return d;
  });

  return { disputeId: dispute.id, status: dispute.status };
}

/**
 * 運営審査結果の適用（管理API想定）
 */
export async function resolveDispute(
  disputeId: string,
  decision: "APPROVED_REFUND" | "REJECTED",
  reviewerNote?: string,
) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { transaction: true },
  });
  if (!dispute) throw new ApiError(404, "異議が見つかりません", "NOT_FOUND");
  if (!["SUBMITTED", "UNDER_REVIEW"].includes(dispute.status)) {
    throw new ApiError(409, "審査できない状態です", "INVALID_STATE");
  }

  if (decision === "APPROVED_REFUND") {
    const stripe = getStripe();
    const tx = dispute.transaction;
    if (!tx.stripePaymentIntentId) {
      throw new ApiError(400, "PaymentIntent がありません", "NO_PI");
    }

    const refund = await stripe.refunds.create({
      payment_intent: tx.stripePaymentIntentId,
      metadata: { disputeId, transactionId: tx.id },
    });

    await prisma.$transaction(async (db) => {
      await db.dispute.update({
        where: { id: disputeId },
        data: {
          status: "APPROVED_REFUND",
          reviewedAt: new Date(),
          reviewerNote,
        },
      });
      await db.transaction.update({
        where: { id: tx.id },
        data: {
          status: "REFUNDED",
          escrowStatus: "REFUNDED",
          stripeRefundId: refund.id,
        },
      });
      await db.serialCode.updateMany({
        where: { transactionId: tx.id },
        data: { status: "INVALID" },
      });
    });

    return { disputeId, decision, refundId: refund.id };
  }

  // 却下 → 取引完了として送金
  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewerNote,
    },
  });

  await prisma.transaction.update({
    where: { id: dispute.transactionId },
    data: { status: "CONFIRMATION_WINDOW" },
  });

  const payout = await releasePayout(dispute.transactionId, "dispute_rejected");
  return { disputeId, decision, payout };
}
