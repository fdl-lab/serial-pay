import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { creditSaleToWallet } from "@/services/wallet";

const ratingSchema = z.object({
  score: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export async function recalcUserRating(rateeId: string) {
  const agg = await prisma.rating.aggregate({
    where: { rateeId },
    _avg: { score: true },
    _count: { _all: true },
  });
  await prisma.user.update({
    where: { id: rateeId },
    data: {
      ratingScore: agg._avg.score ?? 0,
      ratingCount: agg._count._all,
    },
  });
}

/**
 * 開示期限切れ（未開示のまま完了）時: 出品者→購入者の評価1を付与
 */
export async function applyRevealExpiredBuyerPenalty(params: {
  transactionId: string;
  sellerId: string;
  buyerId: string;
}) {
  const existing = await prisma.rating.findUnique({
    where: {
      transactionId_raterId: {
        transactionId: params.transactionId,
        raterId: params.sellerId,
      },
    },
  });
  if (existing) return existing;

  const rating = await prisma.rating.create({
    data: {
      transactionId: params.transactionId,
      raterId: params.sellerId,
      rateeId: params.buyerId,
      score: 1,
      comment: "開示期限切れ（未開示のまま取引完了）",
    },
  });
  await recalcUserRating(params.buyerId);
  return rating;
}

/**
 * 購入者 → 出品者の評価。
 * 評価提出で取引完了・売上ウォレット反映される。
 */
export async function createBuyerRating(
  buyerId: string,
  transactionId: string,
  raw: unknown,
) {
  const input = ratingSchema.parse(raw);

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      item: { select: { title: true } },
      ratings: { where: { raterId: buyerId }, select: { id: true } },
    },
  });

  if (!tx || tx.buyerId !== buyerId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }
  if (tx.ratings.length > 0) {
    throw new ApiError(409, "すでに評価済みだよ", "ALREADY_RATED");
  }
  if (tx.status === "COMPLETED") {
    throw new ApiError(
      409,
      "この取引はすでに完了しているよ（期限切れで自動完了した場合は追加評価できないよ）",
      "ALREADY_COMPLETED",
    );
  }
  if (tx.status !== "CONFIRMATION_WINDOW") {
    throw new ApiError(409, "いまは評価できない状態だよ", "INVALID_STATE");
  }
  if (tx.confirmationDeadlineAt && tx.confirmationDeadlineAt < new Date()) {
    throw new ApiError(
      409,
      "確認期限が過ぎているよ。自動完了を待つかマイページを確認してね",
      "DEADLINE_PASSED",
    );
  }
  if (!tx.buyerConfirmedAt) {
    throw new ApiError(
      409,
      "先に「使えたので受取確認する」を押してね",
      "CONFIRM_REQUIRED",
    );
  }
  if (tx.escrowStatus === "RELEASED") {
    throw new ApiError(409, "すでに売上反映済みだよ", "ALREADY_RELEASED");
  }

  const now = new Date();
  const rating = await prisma.$transaction(async (db) => {
    const r = await db.rating.create({
      data: {
        transactionId: tx.id,
        raterId: buyerId,
        rateeId: tx.sellerId,
        score: input.score,
        comment: input.comment || null,
      },
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
        actorUserId: buyerId,
        action: "RATING_CREATED",
        entityType: "Rating",
        entityId: r.id,
        metadata: {
          score: input.score,
          transactionId: tx.id,
          completed: true,
          sellerPayoutYen: tx.sellerPayoutYen,
        },
      },
    });

    return r;
  });

  await recalcUserRating(tx.sellerId);

  return {
    ratingId: rating.id,
    score: rating.score,
    itemTitle: tx.item.title,
    completed: true,
    creditedYen: tx.sellerPayoutYen,
  };
}

/** 評価して完了させる必要のある取引 */
export async function listPendingBuyerRatings(buyerId: string) {
  const rows = await prisma.transaction.findMany({
    where: {
      buyerId,
      status: "CONFIRMATION_WINDOW",
      buyerConfirmedAt: { not: null },
      ratings: { none: { raterId: buyerId } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      item: { select: { title: true, artistName: true } },
      seller: {
        select: {
          id: true,
          publicId: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return rows.map((tx) => ({
    transactionId: tx.id,
    itemTitle: tx.item.title,
    artistName: tx.item.artistName,
    seller: {
      id: tx.seller.id,
      publicId: tx.seller.publicId,
      displayName: tx.seller.displayName,
      avatarUrl: tx.seller.avatarUrl,
    },
    confirmedAt: tx.buyerConfirmedAt,
    confirmationDeadlineAt: tx.confirmationDeadlineAt,
  }));
}

export async function listSellerRatings(sellerId: string, take = 20) {
  const rows = await prisma.rating.findMany({
    where: { rateeId: sellerId },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      rater: { select: { displayName: true, publicId: true, avatarUrl: true } },
      transaction: {
        include: { item: { select: { title: true } } },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    score: r.score,
    comment: r.comment,
    createdAt: r.createdAt,
    raterName: r.rater.displayName ?? "購入者",
    raterPublicId: r.rater.publicId,
    itemTitle: r.transaction.item.title,
  }));
}

export async function getPublicSellerProfile(publicId: string) {
  const user = await prisma.user.findUnique({
    where: { publicId },
    select: {
      id: true,
      publicId: true,
      displayName: true,
      avatarUrl: true,
      ratingScore: true,
      ratingCount: true,
      completedSales: true,
      createdAt: true,
    },
  });
  if (!user) return null;

  const ratings = await listSellerRatings(user.id, 30);
  return {
    publicId: user.publicId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    ratingScore: Number(user.ratingScore),
    ratingCount: user.ratingCount,
    completedSales: user.completedSales,
    memberSince: user.createdAt,
    ratings,
  };
}
