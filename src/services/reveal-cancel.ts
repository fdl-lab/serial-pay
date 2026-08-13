import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { revealHoldHours } from "@/lib/stripe";
import { creditSaleToWallet } from "@/services/wallet";
import { applyRevealExpiredBuyerPenalty } from "@/services/rating";
import { createUserMessage } from "@/services/messages";

/**
 * 開示前（PAID_ESCROW）の期限切れ処理。
 * 返金はしない（放置＝キャンセル回避の抜け穴を塞ぐ）。
 * 出品者へ売上確定 + 購入者に評価★1。コードは未開示のまま無効化。
 */
export async function forfeitUnrevealedTransaction(
  transactionId: string,
  opts?: { actorUserId?: string | null },
) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { item: { select: { title: true } } },
  });

  if (!tx) throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");

  if (tx.status === "COMPLETED" || tx.escrowStatus === "RELEASED") {
    return {
      transactionId: tx.id,
      alreadySettled: true as const,
      status: tx.status,
    };
  }

  if (tx.status !== "PAID_ESCROW" || tx.codeRevealedAt) {
    throw new ApiError(
      409,
      "開示前の保留中のみ期限切れ処理できます",
      "INVALID_STATE",
    );
  }

  const holdH = revealHoldHours();
  const deadline =
    tx.revealDeadlineAt ??
    new Date(tx.createdAt.getTime() + holdH * 60 * 60_000);
  if (deadline > new Date()) {
    throw new ApiError(409, "まだ開示期限前です", "NOT_EXPIRED");
  }

  const now = new Date();

  await prisma.$transaction(async (db) => {
    // 未開示のまま売上確定するので、コードは再利用不可にする
    await db.serialCode.updateMany({
      where: { transactionId: tx.id },
      data: { status: "INVALID" },
    });

    await creditSaleToWallet(db, {
      sellerId: tx.sellerId,
      amountYen: tx.sellerPayoutYen,
      transactionId: tx.id,
    });

    await db.transaction.update({
      where: { id: tx.id },
      data: {
        status: "COMPLETED",
        escrowStatus: "RELEASED",
        autoCompletedAt: now,
        payoutReleasedAt: now,
      },
    });

    await db.user.update({
      where: { id: tx.sellerId },
      data: { completedSales: { increment: 1 } },
    });
    await db.user.update({
      where: { id: tx.buyerId },
      data: { completedBuys: { increment: 1 } },
    });

    await db.auditLog.create({
      data: {
        actorUserId: opts?.actorUserId ?? null,
        action: "TRANSACTION_REVEAL_FORFEITED",
        entityType: "Transaction",
        entityId: tx.id,
        metadata: {
          reason: "reveal_expired",
          sellerPayoutYen: tx.sellerPayoutYen,
          noRefund: true,
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
    title: "開示期限が切れて取引完了しました",
    body: [
      `「${tx.item.title}」は購入から${holdH}時間以内に開示されなかったため、取引完了になりました。`,
      "返金はされません。購入者評価に★1が記録されました。",
    ].join("\n"),
    linkHref: "/me",
    linkLabel: "マイページを見る",
    relatedEntityType: "Transaction",
    relatedEntityId: tx.id,
  });

  await createUserMessage({
    userId: tx.sellerId,
    kind: "REVEAL_EXPIRED_SELLER",
    title: "未開示のまま期限切れ → 売上確定",
    body: [
      `「${tx.item.title}」は購入者が開示せず期限切れになりました。`,
      "売上はウォレットに反映済みです。購入者には評価★1が付きました。",
    ].join("\n"),
    linkHref: "/me",
    linkLabel: "マイページを見る",
    relatedEntityType: "Transaction",
    relatedEntityId: tx.id,
  });

  return {
    transactionId: tx.id,
    alreadySettled: false as const,
    status: "COMPLETED" as const,
    creditedYen: tx.sellerPayoutYen,
    penaltyApplied: true,
  };
}

/** @deprecated 名称互換 */
export async function cancelUnrevealedTransaction(
  transactionId: string,
  opts?: { actorUserId?: string | null },
) {
  return forfeitUnrevealedTransaction(transactionId, opts);
}

/** Cron: 開示期限切れの PAID_ESCROW を売上確定＋購入者評価1 */
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
      const r = await forfeitUnrevealedTransaction(row.id);
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
