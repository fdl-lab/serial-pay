import { prisma } from "@/lib/prisma";
import { getStripe, confirmationWindowMinutes } from "@/lib/stripe";
import { calcPriceBreakdown } from "@/lib/money";
import { ApiError, assertBuyerEligible } from "@/lib/api";
import { decryptSerial } from "@/lib/crypto/serial";
import type { User } from "@prisma/client";
import { z } from "zod";

const checkoutSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().min(1).max(100).optional(),
});

const RESERVE_MINUTES = 30;

export async function createCheckout(buyer: User, raw: unknown) {
  assertBuyerEligible(buyer);
  const { itemId, quantity: qtyInput } = checkoutSchema.parse(raw);

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

  if (price.amountChargedYen < 50) {
    throw new ApiError(400, "決済金額が小さすぎます", "AMOUNT_TOO_SMALL");
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

    return txRow;
  });

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

  // Separate charges and transfers: プラットフォームが一度受け取り、完了後に Transfer
  const paymentIntent = await stripe.paymentIntents.create({
    amount: price.amountChargedYen,
    currency: "jpy",
    customer: customerId,
    capture_method: "automatic",
    transfer_group: result.id,
    metadata: {
      transactionId: result.id,
      itemId: item.id,
      buyerId: buyer.id,
      sellerId: item.sellerId,
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
    amountChargedYen: price.amountChargedYen,
    quantity,
    reservedUntil: reservedUntil.toISOString(),
  };
}

/**
 * 決済成功後: コード割当・即時開示可能化・確認タイマー開始
 */
export async function fulfillPaidTransaction(paymentIntentId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { item: true, serialCodes: true },
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
        stripeChargeId: paymentIntentId,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: tx.buyerId,
        action: "TRANSACTION_FULFILLED",
        entityType: "Transaction",
        entityId: tx.id,
        metadata: { paymentIntentId, deadline: deadline.toISOString() },
      },
    });
  });

  return { transactionId: tx.id, alreadyFulfilled: false, deadline };
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
