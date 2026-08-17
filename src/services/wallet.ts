import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import type { Prisma, User } from "@prisma/client";

export const PAYOUT_FEE_YEN = 200;

export async function ensureWallet(userId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const existing = await db.wallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.wallet.create({ data: { userId, balanceYen: 0, pendingYen: 0 } });
}

export async function getWalletSummary(userId: string) {
  const wallet = await ensureWallet(userId);
  const [recent, payouts] = await Promise.all([
    prisma.walletLedger.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.payoutRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  return { wallet, recent, payouts, payoutFeeYen: PAYOUT_FEE_YEN };
}

/**
 * 取引完了時: 販売手数料差引後を出品者ウォレットへ加算
 */
export async function creditSaleToWallet(
  db: Prisma.TransactionClient,
  params: {
    sellerId: string;
    amountYen: number;
    transactionId: string;
  },
) {
  const wallet = await ensureWallet(params.sellerId, db);
  const updated = await db.wallet.update({
    where: { id: wallet.id },
    data: { balanceYen: { increment: params.amountYen } },
  });

  await db.walletLedger.create({
    data: {
      walletId: wallet.id,
      type: "SALE_CREDIT",
      amountYen: params.amountYen,
      balanceAfter: updated.balanceYen,
      description: "取引完了による売上加算",
      transactionId: params.transactionId,
    },
  });

  return updated;
}

/**
 * 購入時にウォレット残高を使用
 */
export async function debitWalletForPurchase(
  db: Prisma.TransactionClient,
  params: {
    buyerId: string;
    amountYen: number;
    transactionId: string;
  },
) {
  if (params.amountYen <= 0) return null;

  const wallet = await ensureWallet(params.buyerId, db);
  if (wallet.balanceYen < params.amountYen) {
    throw new ApiError(400, "売上金残高が不足しています", "INSUFFICIENT_WALLET");
  }

  const updated = await db.wallet.update({
    where: { id: wallet.id },
    data: { balanceYen: { decrement: params.amountYen } },
  });

  await db.walletLedger.create({
    data: {
      walletId: wallet.id,
      type: "PURCHASE_DEBIT",
      amountYen: -params.amountYen,
      balanceAfter: updated.balanceYen,
      description: "残高での購入",
      transactionId: params.transactionId,
    },
  });

  return updated;
}

/**
 * 決済キャンセル時などにウォレット先引き分を返金
 */
export async function creditWalletRefund(
  db: Prisma.TransactionClient,
  params: {
    buyerId: string;
    amountYen: number;
    transactionId: string;
    description?: string;
  },
) {
  if (params.amountYen <= 0) return null;

  const wallet = await ensureWallet(params.buyerId, db);
  const updated = await db.wallet.update({
    where: { id: wallet.id },
    data: { balanceYen: { increment: params.amountYen } },
  });

  await db.walletLedger.create({
    data: {
      walletId: wallet.id,
      type: "REFUND_CREDIT",
      amountYen: params.amountYen,
      balanceAfter: updated.balanceYen,
      description: params.description ?? "購入キャンセルによる残高返金",
      transactionId: params.transactionId,
    },
  });

  return updated;
}

/**
 * 振込申請（出金）。手数料一律200円。
 * Stripe Connect へ Transfer し、Connect 側の銀行へ Payout。
 */
export async function requestPayout(user: User, amountYen: number) {
  if (!Number.isInteger(amountYen) || amountYen < 500) {
    throw new ApiError(400, "出金額は500円以上で指定してください", "AMOUNT_INVALID");
  }
  if (user.stripeConnectStatus !== "ACTIVE" || !user.stripeConnectAccountId) {
    throw new ApiError(
      403,
      "出金には Stripe Connect（銀行口座）の登録が必要です",
      "CONNECT_REQUIRED",
    );
  }

  const feeYen = PAYOUT_FEE_YEN;
  const totalDebitYen = amountYen + feeYen;

  const payout = await prisma.$transaction(async (db) => {
    const wallet = await ensureWallet(user.id, db);
    if (wallet.balanceYen < totalDebitYen) {
      throw new ApiError(
        400,
        `残高不足です（出金 ${amountYen} + 手数料 ${feeYen} = ${totalDebitYen} 円が必要）`,
        "INSUFFICIENT_WALLET",
      );
    }

    const afterAmount = await db.wallet.update({
      where: { id: wallet.id },
      data: {
        balanceYen: { decrement: totalDebitYen },
        pendingYen: { increment: amountYen },
      },
    });

    const req = await db.payoutRequest.create({
      data: {
        userId: user.id,
        walletId: wallet.id,
        amountYen,
        feeYen,
        totalDebitYen,
        status: "PROCESSING",
      },
    });

    await db.walletLedger.create({
      data: {
        walletId: wallet.id,
        type: "PAYOUT_DEBIT",
        amountYen: -amountYen,
        balanceAfter: afterAmount.balanceYen + feeYen, // 一時: 次の fee 行で最終残高
        description: "出金申請",
        payoutRequestId: req.id,
      },
    });

    await db.walletLedger.create({
      data: {
        walletId: wallet.id,
        type: "PAYOUT_FEE",
        amountYen: -feeYen,
        balanceAfter: afterAmount.balanceYen,
        description: "出金振込手数料",
        payoutRequestId: req.id,
      },
    });

    return { req, walletId: wallet.id };
  });

  try {
    const stripe = getStripe();
    const transfer = await stripe.transfers.create({
      amount: amountYen,
      currency: "jpy",
      destination: user.stripeConnectAccountId!,
      metadata: {
        payoutRequestId: payout.req.id,
        userId: user.id,
        feeYen: String(feeYen),
      },
    });

    await prisma.payoutRequest.update({
      where: { id: payout.req.id },
      data: {
        status: "PAID",
        stripeTransferId: transfer.id,
        processedAt: new Date(),
      },
    });

    await prisma.wallet.update({
      where: { id: payout.walletId },
      data: { pendingYen: { decrement: amountYen } },
    });

    return {
      payoutRequestId: payout.req.id,
      amountYen,
      feeYen,
      totalDebitYen,
      transferId: transfer.id,
      status: "PAID" as const,
    };
  } catch (e) {
    // 失敗時は残高を戻す
    await prisma.$transaction(async (db) => {
      await db.wallet.update({
        where: { id: payout.walletId },
        data: {
          balanceYen: { increment: totalDebitYen },
          pendingYen: { decrement: amountYen },
        },
      });
      await db.payoutRequest.update({
        where: { id: payout.req.id },
        data: {
          status: "FAILED",
          failureReason: e instanceof Error ? e.message : "transfer_failed",
        },
      });
    });
    throw new ApiError(502, "出金処理に失敗しました。残高は戻してあります", "PAYOUT_FAILED");
  }
}
