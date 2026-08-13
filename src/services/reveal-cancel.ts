import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { getStripe, revealHoldHours } from "@/lib/stripe";
import { creditWalletRefund } from "@/services/wallet";
import { applyRevealExpiredBuyerPenalty } from "@/services/rating";
import { createUserMessage } from "@/services/messages";

/**
 * 開示前（PAID_ESCROW）の強制キャンセル（開示期限切れのみ）。
 * 購入者からの任意キャンセルは不可。返金＋在庫戻し＋購入者評価★1。
 */
export async function cancelUnrevealedTransaction(
  transactionId: string,
  opts?: { actorUserId?: string | null },
) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { item: { select: { title: true } } },
  });

  if (!tx) throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");

  if (tx.status === "CANCELLED" || tx.status === "EXPIRED" || tx.status === "REFUNDED") {
    return { transactionId: tx.id, alreadyCancelled: true as const, status: tx.status };
  }

  if (tx.status !== "PAID_ESCROW" || tx.codeRevealedAt) {
    throw new ApiError(
      409,
      "開示前の保留中だけ期限切れ処理できるよ",
      "INVALID_STATE",
    );
  }

  const holdH = revealHoldHours();
  const deadline =
    tx.revealDeadlineAt ??
    new Date(tx.createdAt.getTime() + holdH * 60 * 60_000);
  if (deadline > new Date()) {
    throw new ApiError(409, "まだ開示期限前だよ", "NOT_EXPIRED");
  }

  let refundId: string | null = null;
  if (tx.stripePaidYen > 0) {
    if (!tx.stripePaymentIntentId) {
      throw new ApiError(400, "PaymentIntent がありません", "NO_PI");
    }
    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: tx.stripePaymentIntentId,
      amount: tx.stripePaidYen,
      metadata: {
        transactionId: tx.id,
        reason: "reveal_expired",
      },
    });
    refundId = refund.id;
  }

  const codes = await prisma.serialCode.findMany({
    where: { transactionId: tx.id },
    select: { id: true },
  });

  await prisma.$transaction(async (db) => {
    if (codes.length > 0) {
      await db.serialCode.updateMany({
        where: { id: { in: codes.map((c) => c.id) } },
        data: {
          status: "AVAILABLE",
          assignedAt: null,
          reservedAt: null,
          reservedUntil: null,
          transactionId: null,
        },
      });
      await db.item.update({
        where: { id: tx.itemId },
        data: {
          stockAvailable: { increment: codes.length },
          status: "ACTIVE",
          soldOutAt: null,
        },
      });
    }

    if (tx.walletPaidYen > 0) {
      await creditWalletRefund(db, {
        buyerId: tx.buyerId,
        amountYen: tx.walletPaidYen,
        transactionId: tx.id,
        description: "開示期限切れによる残高返金",
      });
    }

    await db.transaction.update({
      where: { id: tx.id },
      data: {
        status: "EXPIRED",
        escrowStatus: "REFUNDED",
        stripeRefundId: refundId,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: opts?.actorUserId ?? null,
        action: "TRANSACTION_REVEAL_EXPIRED",
        entityType: "Transaction",
        entityId: tx.id,
        metadata: {
          reason: "reveal_expired",
          refundId,
          restoredCodes: codes.length,
        },
      },
    });
  });

  await applyRevealExpiredBuyerPenalty({
    transactionId: tx.id,
    sellerId: tx.sellerId,
    buyerId: tx.buyerId,
  });

  await createUserMessage({
    userId: tx.buyerId,
    kind: "REVEAL_EXPIRED",
    title: "開示期限が切れてキャンセルされたよ",
    body: [
      `「${tx.item.title}」は購入から${holdH}時間以内に開示されなかったため、自動キャンセル・返金したよ。`,
      "開示期限切れのため、購入者評価に★1が記録されたよ。",
    ].join("\n"),
    linkHref: "/me",
    linkLabel: "マイページを見る",
    relatedEntityType: "Transaction",
    relatedEntityId: tx.id,
  });

  await createUserMessage({
    userId: tx.sellerId,
    kind: "REVEAL_EXPIRED_SELLER",
    title: "未開示のまま期限切れになったよ",
    body: [
      `「${tx.item.title}」は購入者が開示せず期限切れになったよ。`,
      "在庫は戻してあるよ。購入者には評価★1が付いたよ。",
    ].join("\n"),
    linkHref: "/me",
    linkLabel: "マイページを見る",
    relatedEntityType: "Transaction",
    relatedEntityId: tx.id,
  });

  return {
    transactionId: tx.id,
    alreadyCancelled: false as const,
    status: "EXPIRED" as const,
    refundId,
    penaltyApplied: true,
  };
}

/** Cron: 開示期限切れの PAID_ESCROW を強制キャンセル */
export async function expireUnrevealedTransactions() {
  const now = new Date();
  const holdH = revealHoldHours();
  const legacyCutoff = new Date(now.getTime() - holdH * 60 * 60_000);

  const rows = await prisma.transaction.findMany({
    where: {
      status: "PAID_ESCROW",
      codeRevealedAt: null,
      OR: [
        { revealDeadlineAt: { lte: now } },
        { revealDeadlineAt: null, createdAt: { lte: legacyCutoff } },
      ],
    },
    select: { id: true },
    take: 50,
  });

  const results = [];
  for (const row of rows) {
    try {
      const r = await cancelUnrevealedTransaction(row.id);
      results.push(r);
    } catch (e) {
      console.error("expireUnrevealed failed", row.id, e);
      results.push({
        transactionId: row.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}
