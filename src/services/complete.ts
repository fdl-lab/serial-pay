import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { creditSaleToWallet } from "@/services/wallet";

/**
 * 受取確認 → 出品者ウォレットへ売上反映（手数料10%差引後）
 */
export async function confirmReceipt(buyerId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!tx || tx.buyerId !== buyerId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }
  if (tx.status !== "CONFIRMATION_WINDOW") {
    throw new ApiError(409, "受取確認できる状態ではありません", "INVALID_STATE");
  }
  if (tx.confirmationDeadlineAt && tx.confirmationDeadlineAt < new Date()) {
    throw new ApiError(409, "確認期限が過ぎています", "DEADLINE_PASSED");
  }

  return settleToWallet(tx.id, "buyer_confirm");
}

/**
 * 確認ウィンドウ経過後の自動完了
 */
export async function autoCompleteExpired() {
  const now = new Date();
  const expired = await prisma.transaction.findMany({
    where: {
      status: "CONFIRMATION_WINDOW",
      confirmationDeadlineAt: { lte: now },
    },
    select: { id: true },
    take: 50,
  });

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const row of expired) {
    try {
      await settleToWallet(row.id, "auto_complete");
      results.push({ id: row.id, ok: true });
    } catch (e) {
      results.push({
        id: row.id,
        ok: false,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }
  return results;
}

async function settleToWallet(
  transactionId: string,
  reason: "buyer_confirm" | "auto_complete" | "dispute_rejected",
) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!tx) throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");

  if (tx.escrowStatus === "RELEASED" || tx.status === "COMPLETED") {
    return { transactionId, alreadyReleased: true };
  }

  const allowed =
    (reason === "buyer_confirm" && tx.status === "CONFIRMATION_WINDOW") ||
    (reason === "auto_complete" && tx.status === "CONFIRMATION_WINDOW") ||
    (reason === "dispute_rejected" &&
      (tx.status === "DISPUTED" || tx.status === "CONFIRMATION_WINDOW"));

  if (!allowed) {
    throw new ApiError(409, `売上反映できない状態です: ${tx.status}`, "INVALID_STATE");
  }

  const now = new Date();
  await prisma.$transaction(async (db) => {
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
        buyerConfirmedAt: reason === "buyer_confirm" ? now : tx.buyerConfirmedAt,
        autoCompletedAt: reason === "auto_complete" ? now : tx.autoCompletedAt,
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
        actorUserId: reason === "buyer_confirm" ? tx.buyerId : null,
        action: "WALLET_SALE_CREDITED",
        entityType: "Transaction",
        entityId: tx.id,
        metadata: { sellerPayoutYen: tx.sellerPayoutYen, reason },
      },
    });
  });

  return {
    transactionId,
    creditedYen: tx.sellerPayoutYen,
    alreadyReleased: false,
  };
}

/** @deprecated 名称互換。実態はウォレット反映 */
export async function releasePayout(
  transactionId: string,
  reason: "buyer_confirm" | "auto_complete" | "dispute_rejected",
) {
  return settleToWallet(transactionId, reason);
}

export { settleToWallet };
