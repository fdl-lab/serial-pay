import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { getStripe, revealHoldHours } from "@/lib/stripe";
import { creditWalletRefund } from "@/services/wallet";
import { applyRevealExpiredBuyerPenalty } from "@/services/rating";
import { createUserMessage } from "@/services/messages";

export type UnrevealedCancelReason = "buyer_cancel" | "reveal_expired";

/**
 * 開示前（PAID_ESCROW）のキャンセル。
 * - buyer_cancel: 購入者都合（評価ペナルティなし）
 * - reveal_expired: 開示期限切れの強制キャンセル（購入者に評価1）
 */
export async function cancelUnrevealedTransaction(
  transactionId: string,
  opts: {
    reason: UnrevealedCancelReason;
    actorUserId?: string | null;
  },
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
      "開示前の保留中だけキャンセルできるよ",
      "INVALID_STATE",
    );
  }

  if (opts.reason === "buyer_cancel" && opts.actorUserId !== tx.buyerId) {
    throw new ApiError(403, "自分の購入だけキャンセルできるよ", "FORBIDDEN");
  }

  if (opts.reason === "reveal_expired") {
    const holdH = revealHoldHours();
    const deadline =
      tx.revealDeadlineAt ??
      new Date(tx.createdAt.getTime() + holdH * 60 * 60_000);
    if (deadline > new Date()) {
      throw new ApiError(409, "まだ開示期限前だよ", "NOT_EXPIRED");
    }
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
        reason: opts.reason,
      },
    });
    refundId = refund.id;
  }

  const codes = await prisma.serialCode.findMany({
    where: { transactionId: tx.id },
    select: { id: true },
  });

  const nextStatus = opts.reason === "reveal_expired" ? "EXPIRED" : "CANCELLED";

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
        description:
          opts.reason === "reveal_expired"
            ? "開示期限切れによる残高返金"
            : "開示前キャンセルによる残高返金",
      });
    }

    await db.transaction.update({
      where: { id: tx.id },
      data: {
        status: nextStatus,
        escrowStatus: "REFUNDED",
        stripeRefundId: refundId,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: opts.actorUserId ?? null,
        action:
          opts.reason === "reveal_expired"
            ? "TRANSACTION_REVEAL_EXPIRED"
            : "TRANSACTION_UNREVEALED_CANCELLED",
        entityType: "Transaction",
        entityId: tx.id,
        metadata: {
          reason: opts.reason,
          refundId,
          restoredCodes: codes.length,
        },
      },
    });
  });

  if (opts.reason === "reveal_expired") {
    await applyRevealExpiredBuyerPenalty({
      transactionId: tx.id,
      sellerId: tx.sellerId,
      buyerId: tx.buyerId,
    });
  }

  const holdH = revealHoldHours();
  await createUserMessage({
    userId: tx.buyerId,
    kind:
      opts.reason === "reveal_expired"
        ? "REVEAL_EXPIRED"
        : "UNREVEALED_CANCELLED",
    title:
      opts.reason === "reveal_expired"
        ? "開示期限が切れてキャンセルされたよ"
        : "購入をキャンセルしたよ",
    body:
      opts.reason === "reveal_expired"
        ? [
            `「${tx.item.title}」は購入から${holdH}時間以内に開示されなかったため、自動キャンセル・返金したよ。`,
            "開示期限切れのため、購入者評価に★1が記録されたよ。",
          ].join("\n")
        : `「${tx.item.title}」の開示前キャンセルを受け付けたよ。返金手続きをしたよ。`,
    linkHref: "/me",
    linkLabel: "マイページを見る",
    relatedEntityType: "Transaction",
    relatedEntityId: tx.id,
  });

  if (opts.reason === "reveal_expired") {
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
  }

  return {
    transactionId: tx.id,
    alreadyCancelled: false as const,
    status: nextStatus,
    refundId,
    penaltyApplied: opts.reason === "reveal_expired",
  };
}

export async function cancelUnrevealedByBuyer(
  buyerId: string,
  transactionId: string,
) {
  return cancelUnrevealedTransaction(transactionId, {
    reason: "buyer_cancel",
    actorUserId: buyerId,
  });
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
      const r = await cancelUnrevealedTransaction(row.id, {
        reason: "reveal_expired",
        actorUserId: null,
      });
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
