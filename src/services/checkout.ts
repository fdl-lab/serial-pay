import { prisma } from "@/lib/prisma";
import { getStripe, confirmationWindowMinutes } from "@/lib/stripe";
import { calcPriceBreakdown } from "@/lib/money";
import { ApiError, assertBuyerEligible } from "@/lib/api";
import { decryptSerial } from "@/lib/crypto/serial";
import {
  debitWalletForPurchase,
  creditWalletRefund,
  ensureWallet,
} from "@/services/wallet";
import type { PaymentMethod, User } from "@prisma/client";
import { z } from "zod";

const checkoutSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(100).optional(),
  useWalletYen: z.number().int().min(0).optional().default(0),
});

const RESERVE_MINUTES = 30;

export async function createCheckout(buyer: User, raw: unknown) {
  assertBuyerEligible(buyer);
  const { itemId, quantity: qtyInput, useWalletYen: useWalletRaw } =
    checkoutSchema.parse(raw);

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: { seller: true },
  });

  if (!item || item.status !== "ACTIVE") {
    throw new ApiError(404, "出品が見つかりません", "ITEM_NOT_FOUND");
  }
  if (item.sellerId === buyer.id) {
    throw new ApiError(400, "自分の出品は購入できません", "SELF_PURCHASE");
  }
  if (
    item.seller.stripeConnectStatus !== "ACTIVE" ||
    !item.seller.stripeConnectAccountId
  ) {
    throw new ApiError(400, "出品者の受取設定が未完了です", "SELLER_CONNECT");
  }

  const quantity =
    item.listingType === "SET" ? (item.setQuantity ?? item.stockTotal) : (qtyInput ?? 1);

  if (item.listingType === "SET" && qtyInput && qtyInput !== quantity) {
    throw new ApiError(400, "セット販売は分割購入できません", "SET_ONLY");
  }
  if (item.stockAvailable < quantity) {
    throw new ApiError(400, "在庫が不足しています", "OUT_OF_STOCK");
  }

  const price = calcPriceBreakdown({
    unitPriceYen: item.unitPriceYen,
    quantity,
    bulkDiscountEnabled: item.bulkDiscountEnabled,
    bulkDiscountMinQty: item.bulkDiscountMinQty,
    bulkDiscountPercent: item.bulkDiscountPercent,
  });

  if (price.amountChargedYen < 1) {
    throw new ApiError(400, "決済金額が小さすぎます", "AMOUNT_TOO_SMALL");
  }

  const wallet = await ensureWallet(buyer.id);
  const requestedWallet = Math.max(0, useWalletRaw ?? 0);
  const walletPaidYen = Math.min(
    requestedWallet,
    wallet.balanceYen,
    price.amountChargedYen,
  );
  const stripePaidYen = price.amountChargedYen - walletPaidYen;

  let paymentMethod: PaymentMethod = "STRIPE";
  if (walletPaidYen > 0 && stripePaidYen === 0) paymentMethod = "WALLET";
  else if (walletPaidYen > 0 && stripePaidYen > 0) paymentMethod = "MIXED";

  if (stripePaidYen > 0 && stripePaidYen < 50) {
    throw new ApiError(
      400,
      "カード支払額が50円未満になるよ。残高の使い方を調整してね",
      "STRIPE_AMOUNT_TOO_SMALL",
    );
  }

  const reservedUntil = new Date(Date.now() + RESERVE_MINUTES * 60_000);

  const result = await prisma.$transaction(async (tx) => {
    const codes = await tx.serialCode.findMany({
      where: { itemId: item.id, status: "AVAILABLE" },
      take: quantity,
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });

    if (codes.length < quantity) {
      throw new ApiError(400, "在庫が不足しています", "OUT_OF_STOCK");
    }

    const updated = await tx.item.updateMany({
      where: {
        id: item.id,
        stockAvailable: { gte: quantity },
        status: "ACTIVE",
      },
      data: { stockAvailable: { decrement: quantity } },
    });
    if (updated.count === 0) {
      throw new ApiError(409, "在庫の確保に失敗しました。再試行してください", "RACE");
    }

    const txRow = await tx.transaction.create({
      data: {
        itemId: item.id,
        buyerId: buyer.id,
        sellerId: item.sellerId,
        quantity,
        unitPriceYen: price.unitPriceYen,
        subtotalYen: price.subtotalYen,
        discountYen: price.discountYen,
        platformFeeYen: price.platformFeeYen,
        platformFeePercent: price.platformFeePercent,
        amountChargedYen: price.amountChargedYen,
        sellerPayoutYen: price.sellerPayoutYen,
        paymentMethod,
        walletPaidYen,
        stripePaidYen,
        status: "PENDING_PAYMENT",
        escrowStatus: "NONE",
      },
    });

    await tx.serialCode.updateMany({
      where: { id: { in: codes.map((c) => c.id) } },
      data: {
        status: "RESERVED",
        reservedAt: new Date(),
        reservedUntil,
        transactionId: txRow.id,
      },
    });

    if (walletPaidYen > 0) {
      await debitWalletForPurchase(tx, {
        buyerId: buyer.id,
        amountYen: walletPaidYen,
        transactionId: txRow.id,
      });
    }

    return txRow;
  });

  // ウォレット全額払い → 即履行
  if (paymentMethod === "WALLET") {
    await fulfillTransactionById(result.id, { stripePaymentIntentId: null });
    return {
      transactionId: result.id,
      paidWithWallet: true as const,
      amountChargedYen: price.amountChargedYen,
      walletPaidYen,
      stripePaidYen: 0,
      quantity,
      reservedUntil: reservedUntil.toISOString(),
    };
  }

  const stripe = getStripe();
  let customerId = buyer.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: buyer.email,
      metadata: { userId: buyer.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: buyer.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: stripePaidYen,
    currency: "jpy",
    customer: customerId,
    capture_method: "automatic",
    transfer_group: result.id,
    metadata: {
      transactionId: result.id,
      itemId: item.id,
      buyerId: buyer.id,
      sellerId: item.sellerId,
      walletPaidYen: String(walletPaidYen),
      stripePaidYen: String(stripePaidYen),
    },
    automatic_payment_methods: { enabled: true },
  });

  await prisma.transaction.update({
    where: { id: result.id },
    data: { stripePaymentIntentId: paymentIntent.id },
  });

  return {
    transactionId: result.id,
    clientSecret: paymentIntent.client_secret,
    paidWithWallet: false as const,
    amountChargedYen: price.amountChargedYen,
    walletPaidYen,
    stripePaidYen,
    quantity,
    reservedUntil: reservedUntil.toISOString(),
  };
}

async function fulfillTransactionById(
  transactionId: string,
  opts: { stripePaymentIntentId: string | null },
) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { item: true },
  });

  if (!tx) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }
  if (
    tx.status === "PAID_ESCROW" ||
    tx.status === "CONFIRMATION_WINDOW" ||
    tx.status === "COMPLETED"
  ) {
    return { transactionId: tx.id, alreadyFulfilled: true };
  }
  if (tx.status !== "PENDING_PAYMENT") {
    throw new ApiError(409, `不正な取引状態: ${tx.status}`, "INVALID_STATE");
  }

  const windowMin =
    tx.item.confirmationWindowMinutes || confirmationWindowMinutes();
  const now = new Date();
  const deadline = new Date(now.getTime() + windowMin * 60_000);

  await prisma.$transaction(async (db) => {
    await db.serialCode.updateMany({
      where: { transactionId: tx.id, status: "RESERVED" },
      data: {
        status: "ASSIGNED",
        assignedAt: now,
        reservedUntil: null,
      },
    });

    const remaining = await db.item.findUnique({
      where: { id: tx.itemId },
      select: { stockAvailable: true },
    });

    await db.item.update({
      where: { id: tx.itemId },
      data: {
        status: remaining && remaining.stockAvailable <= 0 ? "SOLD_OUT" : undefined,
        soldOutAt:
          remaining && remaining.stockAvailable <= 0 ? now : undefined,
      },
    });

    await db.transaction.update({
      where: { id: tx.id },
      data: {
        status: "CONFIRMATION_WINDOW",
        escrowStatus: "HELD",
        codeRevealedAt: now,
        confirmationDeadlineAt: deadline,
        stripeChargeId: opts.stripePaymentIntentId,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: tx.buyerId,
        action: "TRANSACTION_FULFILLED",
        entityType: "Transaction",
        entityId: tx.id,
        metadata: {
          paymentIntentId: opts.stripePaymentIntentId,
          deadline: deadline.toISOString(),
          paymentMethod: tx.paymentMethod,
        },
      },
    });
  });

  return { transactionId: tx.id, alreadyFulfilled: false, deadline };
}

/**
 * 決済成功後: コード割当・即時開示可能化・確認タイマー開始
 */
export async function fulfillPaidTransaction(paymentIntentId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (!tx) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }

  return fulfillTransactionById(tx.id, { stripePaymentIntentId: paymentIntentId });
}

/**
 * 決済失敗・キャンセル時: 在庫戻し + ウォレット返金
 */
export async function cancelPendingPayment(paymentIntentId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });
  if (!tx) {
    console.warn("cancelPendingPayment: tx not found", paymentIntentId);
    return { cancelled: false };
  }
  if (tx.status !== "PENDING_PAYMENT") {
    return { cancelled: false, reason: tx.status };
  }

  await prisma.$transaction(async (db) => {
    const reserved = await db.serialCode.findMany({
      where: { transactionId: tx.id, status: "RESERVED" },
      select: { id: true },
    });

    if (reserved.length > 0) {
      await db.serialCode.updateMany({
        where: { id: { in: reserved.map((c) => c.id) } },
        data: {
          status: "AVAILABLE",
          reservedAt: null,
          reservedUntil: null,
          transactionId: null,
        },
      });

      await db.item.update({
        where: { id: tx.itemId },
        data: {
          stockAvailable: { increment: reserved.length },
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
      });
    }

    await db.transaction.update({
      where: { id: tx.id },
      data: {
        status: "CANCELLED",
        escrowStatus: "NONE",
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: tx.buyerId,
        action: "TRANSACTION_PAYMENT_CANCELLED",
        entityType: "Transaction",
        entityId: tx.id,
        metadata: { paymentIntentId },
      },
    });
  });

  return { cancelled: true, transactionId: tx.id };
}

export async function revealCodesForBuyer(buyerId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      serialCodes: true,
      item: { select: { title: true, eventName: true } },
    },
  });

  if (!tx || tx.buyerId !== buyerId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }

  const revealable = [
    "PAID_ESCROW",
    "CONFIRMATION_WINDOW",
    "COMPLETED",
    "DISPUTED",
  ];
  if (!revealable.includes(tx.status)) {
    throw new ApiError(403, "まだコードを開示できません", "NOT_REVEALED");
  }

  const codes = tx.serialCodes.map((c) => ({
    id: c.id,
    plaintext: decryptSerial(c.ciphertext),
    status: c.status,
  }));

  return {
    transactionId: tx.id,
    itemTitle: tx.item.title,
    eventName: tx.item.eventName,
    status: tx.status,
    quantity: tx.quantity,
    codeRevealedAt: tx.codeRevealedAt,
    confirmationDeadlineAt: tx.confirmationDeadlineAt,
    buyerConfirmedAt: tx.buyerConfirmedAt,
    codes,
  };
}

export async function getCheckoutSessionForBuyer(
  buyerId: string,
  transactionId: string,
) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      item: { select: { title: true, artistName: true } },
    },
  });

  if (!tx || tx.buyerId !== buyerId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }

  if (tx.status !== "PENDING_PAYMENT") {
    return {
      transactionId: tx.id,
      status: tx.status,
      needsPayment: false as const,
      amountChargedYen: tx.amountChargedYen,
      walletPaidYen: tx.walletPaidYen,
      stripePaidYen: tx.stripePaidYen,
      itemTitle: tx.item.title,
    };
  }

  if (!tx.stripePaymentIntentId || tx.stripePaidYen <= 0) {
    throw new ApiError(409, "カード決済が不要な取引です", "NO_CARD_PAYMENT");
  }

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(tx.stripePaymentIntentId);
  if (!pi.client_secret) {
    throw new ApiError(500, "決済情報の取得に失敗しました", "NO_CLIENT_SECRET");
  }

  return {
    transactionId: tx.id,
    status: tx.status,
    needsPayment: true as const,
    clientSecret: pi.client_secret,
    amountChargedYen: tx.amountChargedYen,
    walletPaidYen: tx.walletPaidYen,
    stripePaidYen: tx.stripePaidYen,
    itemTitle: tx.item.title,
    artistName: tx.item.artistName,
  };
}
