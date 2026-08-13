import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { ApiError } from "@/lib/api";
import { creditWalletRefund } from "@/services/wallet";
import {
  createUserMessage,
  DISPUTE_REFUND_ETA_DAYS,
} from "@/services/messages";
import { RECORDING_MAX_DURATION_SEC } from "@/lib/storage/recording";

/** 却下後の再申請猶予（日） */
const REAPPLY_WINDOW_DAYS = 7;

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
  screenRecordingKey: z.string().min(1),
  recordingDurationSec: z
    .number()
    .int()
    .min(5)
    .max(RECORDING_MAX_DURATION_SEC),
  /** 編集・AI加工なし・3分以内切り取りの確認 */
  attestUnedited: z.literal(true),
});

export async function createDispute(buyerId: string, transactionId: string, raw: unknown) {
  const input = disputeSchema.parse(raw);

  if (!input.screenRecordingUrl || !input.screenRecordingKey) {
    throw new ApiError(
      400,
      "画面録画の添付がない申請は自動却下されます",
      "RECORDING_REQUIRED",
    );
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { item: { select: { title: true } } },
  });

  if (!tx || tx.buyerId !== buyerId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }
  if (tx.buyerConfirmedAt) {
    throw new ApiError(409, "受取確認済みのため異議は出せません", "ALREADY_CONFIRMED");
  }

  const existing = await prisma.dispute.findUnique({
    where: { transactionId },
  });

  const isReapply = existing?.status === "REJECTED";

  if (existing && !isReapply) {
    throw new ApiError(409, "既に異議申し立て済みです", "ALREADY_DISPUTED");
  }

  // 初回・再申請とも確認ウィンドウ中のみ
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

  // 異議中は確認タイマーを停止（残り時間を保存）
  const pausedRemainingSec = Math.max(
    0,
    Math.ceil((tx.confirmationDeadlineAt!.getTime() - now.getTime()) / 1000),
  );

  const dispute = await prisma.$transaction(async (db) => {
    const d = isReapply
      ? await db.dispute.update({
          where: { id: existing!.id },
          data: {
            reason: input.reason,
            description: input.description,
            screenRecordingUrl: input.screenRecordingUrl,
            screenRecordingKey: input.screenRecordingKey,
            recordingDurationSec: input.recordingDurationSec,
            status: "SUBMITTED",
            filedWithinWindow: true,
            reviewedAt: null,
            reviewerNote: null,
            reviewStartedAt: null,
          },
        })
      : await db.dispute.create({
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
      data: {
        status: "DISPUTED",
        confirmationDeadlineAt: null,
        confirmationPausedRemainingSec: pausedRemainingSec,
      },
    });

    await db.serialCode.updateMany({
      where: { transactionId },
      data: { status: "DISPUTED" },
    });

    if (!isReapply) {
      await db.user.update({
        where: { id: buyerId },
        data: { disputeCountAsBuyer: { increment: 1 } },
      });
      await db.user.update({
        where: { id: tx.sellerId },
        data: { disputeCountAsSeller: { increment: 1 } },
      });
    }

    await db.auditLog.create({
      data: {
        actorUserId: buyerId,
        action: isReapply ? "DISPUTE_REAPPLIED" : "DISPUTE_SUBMITTED",
        entityType: "Dispute",
        entityId: d.id,
        metadata: {
          reason: input.reason,
          recordingDurationSec: input.recordingDurationSec,
          attestUnedited: true,
        },
      },
    });

    return d;
  });

  const itemLabel = tx.item.title;
  await createUserMessage({
    userId: buyerId,
    kind: isReapply ? "DISPUTE_REAPPLIED" : "DISPUTE_SUBMITTED",
    title: isReapply ? "異議を再申請しました" : "異議申し立てを受け付けました",
    body: [
      `「${itemLabel}」の異議を事務局が確認します。`,
      "審査中は確認タイマーを停止しています。",
      `許可された場合、事務局確認後およそ1〜2週間（目安${DISPUTE_REFUND_ETA_DAYS}日以内）でウォレット残高へ返金されます。`,
      "審査にはお時間をいただくことがあります。結果はマイページのメッセージでお知らせします。",
    ].join("\n"),
    linkHref: `/transactions/${transactionId}`,
    linkLabel: "取引を見る",
    relatedEntityType: "Dispute",
    relatedEntityId: dispute.id,
  });

  return { disputeId: dispute.id, status: dispute.status, reapplied: isReapply };
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
    include: {
      transaction: {
        include: { item: { select: { title: true } } },
      },
    },
  });
  if (!dispute) throw new ApiError(404, "異議が見つかりません", "NOT_FOUND");
  if (!["SUBMITTED", "UNDER_REVIEW"].includes(dispute.status)) {
    throw new ApiError(409, "審査できない状態です", "INVALID_STATE");
  }

  const itemLabel = dispute.transaction.item.title;
  const tx = dispute.transaction;

  if (decision === "APPROVED_REFUND") {
    let refundId: string | null = null;

    if (tx.stripePaidYen > 0) {
      if (!tx.stripePaymentIntentId) {
        throw new ApiError(400, "PaymentIntent がありません", "NO_PI");
      }
      const stripe = getStripe();
      const refund = await stripe.refunds.create({
        payment_intent: tx.stripePaymentIntentId,
        amount: tx.stripePaidYen,
        metadata: { disputeId, transactionId: tx.id },
      });
      refundId = refund.id;
    }

    await prisma.$transaction(async (db) => {
      if (tx.walletPaidYen > 0) {
        await creditWalletRefund(db, {
          buyerId: tx.buyerId,
          amountYen: tx.walletPaidYen,
          transactionId: tx.id,
          description: "異議許可による残高返金",
        });
      }

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
          stripeRefundId: refundId,
        },
      });
      await db.serialCode.updateMany({
        where: { transactionId: tx.id },
        data: { status: "INVALID" },
      });
    });

    await createUserMessage({
      userId: tx.buyerId,
      kind: "DISPUTE_APPROVED",
      title: "異議が許可されました",
      body: [
        `「${itemLabel}」の異議申し立てが許可されました。`,
        `ウォレット残高への返金は${DISPUTE_REFUND_ETA_DAYS}日以内を目安に反映されます（事務局確認後およそ1〜2週間）。`,
        reviewerNote ? `事務局メモ: ${reviewerNote}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      linkHref: "/me",
      linkLabel: "マイページを見る",
      relatedEntityType: "Dispute",
      relatedEntityId: disputeId,
    });

    return { disputeId, decision, refundId };
  }

  // 却下 → 止めていたタイマーを再開。再申請猶予（7日）未満ならそちらまで延長
  const nowReject = new Date();
  const resumedFromPause = new Date(
    nowReject.getTime() +
      Math.max(0, tx.confirmationPausedRemainingSec ?? 0) * 1000,
  );
  const reapplyDeadline = new Date(
    nowReject.getTime() + REAPPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const deadline =
    resumedFromPause > reapplyDeadline ? resumedFromPause : reapplyDeadline;

  await prisma.$transaction(async (db) => {
    await db.dispute.update({
      where: { id: disputeId },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewerNote,
      },
    });

    await db.transaction.update({
      where: { id: dispute.transactionId },
      data: {
        status: "CONFIRMATION_WINDOW",
        confirmationDeadlineAt: deadline,
        confirmationPausedRemainingSec: null,
      },
    });

    await db.serialCode.updateMany({
      where: { transactionId: dispute.transactionId },
      data: { status: "ASSIGNED" },
    });
  });

  await createUserMessage({
    userId: tx.buyerId,
    kind: "DISPUTE_REJECTED",
    title: "異議が却下されました",
    body: [
      `「${itemLabel}」の異議申し立ては却下されました。`,
      "必要事項を追記のうえ、再申請してください。",
      `再申請の期限は ${deadline.toLocaleString("ja-JP")} までです。`,
      reviewerNote ? `事務局メモ: ${reviewerNote}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    linkHref: `/transactions/${tx.id}/dispute`,
    linkLabel: "再申請する",
    relatedEntityType: "Dispute",
    relatedEntityId: disputeId,
  });

  return { disputeId, decision, reapplyDeadline: deadline };
}
